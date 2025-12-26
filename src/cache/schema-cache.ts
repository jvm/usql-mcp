/**
 * Schema caching to reduce subprocess overhead
 * Caches list_tables and describe_table results with TTL
 */

import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:cache:schema");

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class SchemaCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private hits = 0;
  private misses = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private ttlMs: number) {
    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, Math.min(ttlMs, 60000)); // Clean up at most every minute

    // Don't block process exit
    this.cleanupInterval.unref();

    logger.debug("[schema-cache] Initialized", { ttlMs });
  }

  /**
   * Generate cache key from connection and operation
   */
  private generateKey(
    connectionHash: string,
    operation: string,
    params: Record<string, unknown>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${JSON.stringify(params[key])}`)
      .join("|");

    return `${connectionHash}:${operation}:${sortedParams}`;
  }

  /**
   * Get a cached value
   */
  get<T>(
    connectionHash: string,
    operation: string,
    params: Record<string, unknown> = {}
  ): T | null {
    const key = this.generateKey(connectionHash, operation, params);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses++;
      logger.debug("[schema-cache] Cache miss", { key });
      return null;
    }

    const now = Date.now();
    if (now >= entry.expiresAt) {
      // Expired
      this.cache.delete(key);
      this.misses++;
      logger.debug("[schema-cache] Cache expired", { key });
      return null;
    }

    this.hits++;
    logger.debug("[schema-cache] Cache hit", { key });
    return entry.value;
  }

  /**
   * Set a cached value
   */
  set<T>(
    connectionHash: string,
    operation: string,
    params: Record<string, unknown> = {},
    value: T
  ): void {
    const key = this.generateKey(connectionHash, operation, params);
    const expiresAt = Date.now() + this.ttlMs;

    this.cache.set(key, { value, expiresAt });

    logger.debug("[schema-cache] Cache set", {
      key,
      ttlMs: this.ttlMs,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Invalidate cache for a specific connection
   */
  invalidate(connectionHash: string): void {
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${connectionHash}:`)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    logger.debug("[schema-cache] Invalidated connection cache", {
      connectionHash,
      deleted,
    });
  }

  /**
   * Invalidate cache for a specific operation on a connection
   */
  invalidateOperation(connectionHash: string, operation: string): void {
    let deleted = 0;
    const prefix = `${connectionHash}:${operation}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    logger.debug("[schema-cache] Invalidated operation cache", {
      connectionHash,
      operation,
      deleted,
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;

    logger.debug("[schema-cache] Cleared cache", { size });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("[schema-cache] Cleaned up expired entries", {
        cleaned,
        remaining: this.cache.size,
      });
    }
  }

  /**
   * Shutdown the cache
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    logger.debug("[schema-cache] Shutdown");
  }
}

// Global schema cache instance
let schemaCache: SchemaCache | null = null;

export function initializeSchemaCache(ttlMs: number): void {
  if (schemaCache) {
    schemaCache.shutdown();
  }
  schemaCache = new SchemaCache(ttlMs);
}

export function getCachedSchema<T>(
  connectionHash: string,
  operation: string,
  params: Record<string, unknown> = {}
): T | null {
  if (!schemaCache) {
    return null;
  }
  return schemaCache.get<T>(connectionHash, operation, params);
}

export function setCachedSchema<T>(
  connectionHash: string,
  operation: string,
  params: Record<string, unknown> = {},
  value: T
): void {
  if (schemaCache) {
    schemaCache.set(connectionHash, operation, params, value);
  }
}

export function invalidateSchemaCache(connectionHash: string): void {
  if (schemaCache) {
    schemaCache.invalidate(connectionHash);
  }
}

export function invalidateSchemaCacheOperation(
  connectionHash: string,
  operation: string
): void {
  if (schemaCache) {
    schemaCache.invalidateOperation(connectionHash, operation);
  }
}

export function clearSchemaCache(): void {
  if (schemaCache) {
    schemaCache.clear();
  }
}

export function getSchemaCacheStats(): CacheStats | null {
  if (!schemaCache) {
    return null;
  }
  return schemaCache.getStats();
}

export function shutdownSchemaCache(): void {
  if (schemaCache) {
    schemaCache.shutdown();
    schemaCache = null;
  }
}
