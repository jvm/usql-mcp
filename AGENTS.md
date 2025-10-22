# Repository Guidelines

## Project Structure & Module Organization
The TypeScript entrypoint lives in `src/index.ts`, which wires MCP server registration and tool exports. Handlers for Claude tools reside in `src/tools/`, usql integration helpers in `src/usql/`, shared utilities in `src/utils/`, and shared input/output contracts in `src/types/`. Build output is emitted to `dist/` by `npm run build`—keep it out of git. Configuration samples live in `config.example.json`, while the Jest suite sits under `tests/unit/`.

## Build, Test, and Development Commands
- `npm run dev` — TypeScript watch mode for rapid feedback.
- `npm run build` — Produces production-ready files in `dist/`.
- `npm run prepare` — Runs as part of install/publish to build `dist/`; invoke manually if you need a fresh build for `npm link`/`npx` tests.
- `npm run start` — Executes the compiled server (`npm run build` first).
- `npm run lint` / `npm run format` / `npm run type-check` — Keep code style, formatting, and types aligned.
- Per-call overrides: every tool input supports `timeout_ms` (number or null) to override the configured timeout. Use `null` for unlimited execution on that call.
Install dependencies with `npm install` before running any scripts.

## Coding Style & Naming Conventions
Prettier and ESLint enforce 2-space indentation, trailing commas, and semicolons; run `npm run format` before sending reviews. Favor named exports, camelCase for variables and functions, PascalCase for classes and enums, and suffix handler files with `-tool.ts` for clarity. Mirror source files in tests (e.g., `tools/foo-tool.ts` → `tests/unit/tools/foo-tool.test.ts`). Keep modules focused and split helpers into `src/utils/` when reusable.

## Testing Guidelines
Jest powers the unit suite (`jest.config.js`). Run `npm test` or `npm run test:unit` for fast feedback. Prefer isolated unit tests with lightweight mocks; if you need live database coverage, build it as an opt-in workflow outside this repo. When adding tests, describe behavior in `describe` blocks and assert expected outcomes explicitly.

## Commit & Pull Request Guidelines
Adopt Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) with subjects under 72 characters and bodies capturing motivation plus notable implementation notes. Commits must pass lint, type-check, and relevant test suites. Pull requests should summarize the change, reference related issues, outline testing evidence (command output or screenshots), and note any config or documentation updates (e.g., edits to `QUICKSTART.md` or `DEVELOPMENT.md`).

## Security & Configuration Tips
Avoid committing secrets or local configs; keep connection strings in environment variables such as `USQL_POSTGRES` and `.env` files out of version control. Document required variables in PRs and update `config.example.json` when new fields are introduced. Use `USQL_DEFAULT_CONNECTION` (or `defaults.defaultConnection` in `config.json`) to define a safe default connection instead of embedding credentials in code. Scrub logs before sharing and review dependency licenses before adding them. Prefer Node 18+ locally to match current tooling support. When a call needs a different timeout than the global default, pass `timeout_ms` in the tool arguments (set it to `null` for unlimited).
