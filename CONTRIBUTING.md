# Contributing

Thanks for your interest in improving `usql-mcp`! This project is designed to be lightweight and predictable so that MCP clients can rely on it in production. To keep things smooth we follow a few simple guidelines.

## Quick Start

1. Fork the repository and create a feature branch from `main`.
2. Install dependencies and build the project:

   ```bash
   npm install
   npm run build
   ```

3. Make your changes following the coding standards below.
4. Run the full quality gate before sending a PR:

   ```bash
   npm run lint
   npm run test
   npm run type-check
   ```

5. Open a pull request describing the change, its motivation, and any testing performed. Reference related issues if applicable.

## Coding Standards

- Use TypeScript strict mode (already enforced). Avoid disabling ESLint/TS rules unless absolutely necessary.
- Keep modules small and focused. Shared helpers live in `src/utils/`, connection logic in `src/usql/`, and tool handlers in `src/tools/`.
- Each tool accepts `timeout_ms` overrides—ensure new tools follow the same pattern for consistency.
- When touching the CLI behaviour or schemas, update both the TypeScript sources and any documentation that references them.

## Testing & Tooling

- Unit tests live under `tests/unit/` and should run without external services.
- For database-specific behaviour, prefer mocked interfaces or opt-in manual testing instructions rather than automated integration tests.
- We ship the compiled output via the npm `prepare` script, so verify that `npm run build` succeeds before publishing or linking.

## Security & Disclosures

If you discover a security vulnerability, please open a private security advisory via GitHub (Security → Advisories) rather than filing a public issue. We will coordinate a fix and disclosure timeline through the advisory workflow.

## Release Process

- Bump the version in `package.json` using semantic versioning.
- Run `npm run build`, then `npm publish --access public` when shipping a release.
- Tag the release in GitHub (`gh release create vX.Y.Z --generate-notes --latest`) to keep changelogs aligned.

Thank you for helping improve the project!
