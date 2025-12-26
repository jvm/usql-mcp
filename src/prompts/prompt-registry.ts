/**
 * Central registry for all prompt templates
 * Prompts provide standardized SQL workflows for common tasks
 */

import { GetPromptResult, Prompt, PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("usql-mcp:prompts:registry");

export interface PromptTemplate {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  getMessages: (args: Record<string, string>) => PromptMessage[];
}

class PromptRegistry {
  private prompts: Map<string, PromptTemplate> = new Map();

  register(template: PromptTemplate): void {
    logger.debug("[prompt-registry] Registering prompt", { name: template.name });
    this.prompts.set(template.name, template);
  }

  list(): Prompt[] {
    return Array.from(this.prompts.values()).map((template) => ({
      name: template.name,
      description: template.description,
      arguments: template.arguments,
    }));
  }

  get(name: string, args: Record<string, string>): GetPromptResult {
    const template = this.prompts.get(name);
    if (!template) {
      throw new Error(`Prompt not found: ${name}`);
    }

    // Validate required arguments
    if (template.arguments) {
      for (const arg of template.arguments) {
        if (arg.required && !args[arg.name]) {
          throw new Error(
            `Missing required argument '${arg.name}' for prompt '${name}'`
          );
        }
      }
    }

    logger.debug("[prompt-registry] Getting prompt", { name, args });
    return {
      description: template.description,
      messages: template.getMessages(args),
    };
  }

  has(name: string): boolean {
    return this.prompts.has(name);
  }
}

// Singleton instance
const registry = new PromptRegistry();

export function registerPrompt(template: PromptTemplate): void {
  registry.register(template);
}

export function listPrompts(): Prompt[] {
  return registry.list();
}

export function getPrompt(name: string, args: Record<string, string>): GetPromptResult {
  return registry.get(name, args);
}

export function hasPrompt(name: string): boolean {
  return registry.has(name);
}
