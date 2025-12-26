/**
 * ListChanged notification system for MCP protocol
 * Emits notifications when tools, resources, or prompts lists change
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:notifications:list-changed");

type ListType = "tools" | "resources" | "prompts";

class ListChangedNotifier {
  private server: Server | null = null;

  /**
   * Initialize the notifier with a server instance
   */
  initialize(server: Server): void {
    this.server = server;
    logger.debug("[list-changed] Initialized with server");
  }

  /**
   * Emit a list changed notification
   */
  async notifyListChanged(listType: ListType): Promise<void> {
    if (!this.server) {
      logger.warn("[list-changed] Cannot notify, server not initialized");
      return;
    }

    const method = `notifications/${listType}/list_changed`;

    logger.debug("[list-changed] Emitting notification", { method, listType });

    try {
      await this.server.notification({
        method,
      });
    } catch (error) {
      logger.error("[list-changed] Error sending notification", { method, error });
    }
  }

  /**
   * Notify that tools list has changed
   */
  async notifyToolsChanged(): Promise<void> {
    await this.notifyListChanged("tools");
  }

  /**
   * Notify that resources list has changed
   */
  async notifyResourcesChanged(): Promise<void> {
    await this.notifyListChanged("resources");
  }

  /**
   * Notify that prompts list has changed
   */
  async notifyPromptsChanged(): Promise<void> {
    await this.notifyListChanged("prompts");
  }
}

// Singleton instance
const notifier = new ListChangedNotifier();

export function initializeListChangedNotifier(server: Server): void {
  notifier.initialize(server);
}

export function notifyToolsChanged(): Promise<void> {
  return notifier.notifyToolsChanged();
}

export function notifyResourcesChanged(): Promise<void> {
  return notifier.notifyResourcesChanged();
}

export function notifyPromptsChanged(): Promise<void> {
  return notifier.notifyPromptsChanged();
}
