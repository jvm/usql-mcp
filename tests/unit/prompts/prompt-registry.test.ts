/**
 * Tests for prompt registry
 */

import {
  registerPrompt,
  listPrompts,
  getPrompt,
  hasPrompt,
} from "../../../src/prompts/index.js";
import type { PromptTemplate } from "../../../src/prompts/prompt-registry.js";
import { PromptMessage } from "@modelcontextprotocol/sdk/types.js";

describe("PromptRegistry", () => {
  // Note: Prompts are registered globally, so we need to be careful about test isolation
  // We'll use unique names for test prompts

  describe("registerPrompt", () => {
    it("should register a prompt", () => {
      const testPrompt: PromptTemplate = {
        name: "test_prompt_1",
        description: "A test prompt",
        getMessages: (): PromptMessage[] => [
          {
            role: "user",
            content: { type: "text", text: "Test" },
          },
        ],
      };

      registerPrompt(testPrompt);
      expect(hasPrompt("test_prompt_1")).toBe(true);
    });

    it("should register a prompt with arguments", () => {
      const testPrompt: PromptTemplate = {
        name: "test_prompt_with_args",
        description: "A test prompt with arguments",
        arguments: [
          { name: "arg1", description: "First argument", required: true },
          { name: "arg2", description: "Second argument", required: false },
        ],
        getMessages: (): PromptMessage[] => [
          {
            role: "user",
            content: { type: "text", text: "Test" },
          },
        ],
      };

      registerPrompt(testPrompt);
      expect(hasPrompt("test_prompt_with_args")).toBe(true);

      const prompts = listPrompts();
      const registered = prompts.find((p) => p.name === "test_prompt_with_args");
      expect(registered).toBeDefined();
      expect(registered?.arguments).toHaveLength(2);
    });
  });

  describe("listPrompts", () => {
    it("should list all registered prompts", () => {
      const prompts = listPrompts();
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);
    });

    it("should include default prompts from templates", () => {
      const prompts = listPrompts();
      const promptNames = prompts.map((p) => p.name);

      // Check that our default prompts are registered
      expect(promptNames).toContain("analyze_performance");
      expect(promptNames).toContain("profile_data_quality");
      expect(promptNames).toContain("generate_migration");
      expect(promptNames).toContain("explain_schema");
      expect(promptNames).toContain("optimize_query");
      expect(promptNames).toContain("debug_slow_query");
    });

    it("should return prompts with required fields", () => {
      const prompts = listPrompts();

      for (const prompt of prompts) {
        expect(prompt).toHaveProperty("name");
        expect(prompt).toHaveProperty("description");
        expect(typeof prompt.name).toBe("string");
        expect(typeof prompt.description).toBe("string");
        expect(prompt.name.length).toBeGreaterThan(0);
        if (prompt.description) {
          expect(prompt.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("getPrompt", () => {
    it("should get a prompt with valid arguments", () => {
      const result = getPrompt("analyze_performance", {
        connection: "postgres://localhost/test",
        query: "SELECT * FROM users",
      });

      expect(result).toHaveProperty("description");
      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should throw error for non-existent prompt", () => {
      expect(() => {
        getPrompt("non_existent_prompt", {});
      }).toThrow("Prompt not found: non_existent_prompt");
    });

    it("should throw error for missing required arguments", () => {
      expect(() => {
        getPrompt("analyze_performance", {});
      }).toThrow("Missing required argument 'connection'");
    });

    it("should accept optional arguments", () => {
      // analyze_performance has optional 'query' argument
      const result = getPrompt("analyze_performance", {
        connection: "postgres://localhost/test",
      });

      expect(result).toHaveProperty("messages");
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should return different messages based on arguments", () => {
      // analyze_performance returns different messages based on whether query is provided
      const withQuery = getPrompt("analyze_performance", {
        connection: "postgres://localhost/test",
        query: "SELECT * FROM users",
      });

      const withoutQuery = getPrompt("analyze_performance", {
        connection: "postgres://localhost/test",
      });

      expect(withQuery.messages).not.toEqual(withoutQuery.messages);
    });
  });

  describe("hasPrompt", () => {
    it("should return true for existing prompts", () => {
      expect(hasPrompt("analyze_performance")).toBe(true);
      expect(hasPrompt("optimize_query")).toBe(true);
    });

    it("should return false for non-existent prompts", () => {
      expect(hasPrompt("non_existent_prompt")).toBe(false);
      expect(hasPrompt("")).toBe(false);
    });
  });

  describe("Prompt messages", () => {
    it("should include user role in messages", () => {
      const result = getPrompt("optimize_query", {
        connection: "postgres://localhost/test",
        query: "SELECT * FROM users",
      });

      const userMessages = result.messages.filter((m) => m.role === "user");
      expect(userMessages.length).toBeGreaterThan(0);
    });

    it("should include assistant role in messages", () => {
      const result = getPrompt("optimize_query", {
        connection: "postgres://localhost/test",
        query: "SELECT * FROM users",
      });

      const assistantMessages = result.messages.filter((m) => m.role === "assistant");
      expect(assistantMessages.length).toBeGreaterThan(0);
    });

    it("should have text content in messages", () => {
      const result = getPrompt("debug_slow_query", {
        connection: "postgres://localhost/test",
        query: "SELECT * FROM large_table",
      });

      for (const message of result.messages) {
        expect(message.content).toHaveProperty("type", "text");
        if (message.content.type === "text") {
          expect(message.content).toHaveProperty("text");
          expect(typeof message.content.text).toBe("string");
          expect(message.content.text.length).toBeGreaterThan(0);
        }
      }
    });

    it("should interpolate arguments into message text", () => {
      const connection = "postgres://localhost/test";
      const query = "SELECT * FROM users WHERE id = 1";

      const result = getPrompt("optimize_query", {
        connection,
        query,
      });

      const messageText = result.messages
        .map((m) => (m.content.type === "text" ? m.content.text : ""))
        .join(" ");

      expect(messageText).toContain(connection);
      expect(messageText).toContain(query);
    });
  });

  describe("All default prompts", () => {
    const defaultPrompts = [
      { name: "analyze_performance", requiredArgs: ["connection"] },
      { name: "profile_data_quality", requiredArgs: ["connection", "table"] },
      { name: "generate_migration", requiredArgs: ["connection", "description"] },
      { name: "explain_schema", requiredArgs: ["connection"] },
      { name: "optimize_query", requiredArgs: ["connection", "query"] },
      { name: "debug_slow_query", requiredArgs: ["connection", "query"] },
    ];

    it.each(defaultPrompts)(
      "should have valid structure for $name",
      ({ name, requiredArgs }: { name: string; requiredArgs: string[] }) => {
        const prompts = listPrompts();
        const prompt = prompts.find((p) => p.name === name);

        expect(prompt).toBeDefined();
        expect(prompt?.name).toBe(name);
        expect(prompt?.description).toBeTruthy();
        if (prompt?.description) {
          expect(prompt.description.length).toBeGreaterThan(10);
        }

        // Check that required arguments are defined
        if (requiredArgs.length > 0) {
          expect(prompt?.arguments).toBeDefined();
          const argNames = prompt?.arguments?.map((a) => a.name) ?? [];
          for (const reqArg of requiredArgs) {
            expect(argNames).toContain(reqArg);
          }
        }
      }
    );

    it.each(defaultPrompts)(
      "should return valid messages for $name",
      ({ name, requiredArgs }: { name: string; requiredArgs: string[] }) => {
        const args: Record<string, string> = {
          connection: "postgres://localhost/test",
          query: "SELECT * FROM users",
          table: "users",
          description: "Add email column",
          database: "testdb",
        };

        // Build minimal args
        const minimalArgs: Record<string, string> = {};
        for (const arg of requiredArgs) {
          minimalArgs[arg] = args[arg];
        }

        const result = getPrompt(name, minimalArgs);

        expect(result.description).toBeTruthy();
        expect(result.messages).toBeDefined();
        expect(Array.isArray(result.messages)).toBe(true);
        expect(result.messages.length).toBeGreaterThan(0);

        // Should have at least one user message and one assistant message
        const userMessages = result.messages.filter((m) => m.role === "user");
        const assistantMessages = result.messages.filter((m) => m.role === "assistant");

        expect(userMessages.length).toBeGreaterThan(0);
        expect(assistantMessages.length).toBeGreaterThan(0);
      }
    );
  });
});
