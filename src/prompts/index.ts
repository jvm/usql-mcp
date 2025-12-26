/**
 * Prompts module - SQL workflow templates
 */

export { registerPrompt, listPrompts, getPrompt, hasPrompt } from "./prompt-registry.js";
export type { PromptTemplate } from "./prompt-registry.js";

// Import all templates to ensure they are registered
import "./templates/index.js";
