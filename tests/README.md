# Testing Guide

This directory contains the Jest unit tests for the usql-mcp server.

## Test Structure

- **`unit/`** – Self-contained unit tests (no external databases required)

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Only Unit Tests

```bash
npm run test:unit
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npm test -- connection.test.ts
```

## Writing New Tests

### Unit Test Template

```typescript
import { myFunction } from "../../src/utils/my-module.js";

describe("My Module", () => {
  it("should do something", () => {
    const result = myFunction("input");
    expect(result).toBe("expected");
  });
});
```

## CI/CD Integration

Unit tests run without external services, making them suitable for CI environments by default.

## Coverage Reports

Generate test coverage report:

```bash
npm test -- --coverage
```

Coverage reports are generated in the `coverage/` directory.

## Troubleshooting

### "usql command not found"

If you see this error in integration tests:

1. Verify usql is installed: `which usql`
2. Add usql to PATH if needed: `export PATH="/usr/local/bin:$PATH"`
3. Or skip integration tests: `SKIP_INTEGRATION_TESTS=1 npm test`

### "Cannot find test database"

Run the setup command:

```bash
sqlite3 tests/fixtures/test.db < tests/fixtures/schema.sql
```

### Tests timeout

Some queries might be slow. Increase the test timeout:

```bash
npm test -- --testTimeout=120000
```

## Best Practices

1. **Keep unit tests fast** - Use mocks for external dependencies
2. **Isolate tests** - Each test should be independent
3. **Use descriptive names** - Test names should describe what they test
4. **Test error cases** - Include tests for error handling
5. **Document setup** - Include comments for non-obvious setup steps
