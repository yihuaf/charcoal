# Agent Guidelines for Charcoal

## Build & Test Commands

- **Build**: `cd apps/cli && yarn build` (lints, compiles TS, copies assets)
- **Lint**: `cd apps/cli && yarn lint` (ESLint with cache)
- **Type check**: `cd apps/cli && yarn check` (tsc --noEmit)
- **Run tests**: `cd apps/cli && DEBUG=1 yarn test --full-trace`
- **Run single test**: `cd apps/cli && DEBUG=1 yarn test-one "dist/test/<path>.test.js"`
- **Run test pattern**: `cd apps/cli && DEBUG=1 yarn test -g "pattern"`
- **Run CLI locally**: `cd apps/cli && yarn cli <command>`

## Code Style

- **Imports**: No default exports (`import/no-default-export`), imports first, use named exports
- **Types**: Strict mode enabled, explicit return types required (`@typescript-eslint/explicit-module-boundary-types`)
- **Functions**: Max 120 lines per function, max 3 parameters
- **Errors**: Custom error classes extend Error with descriptive names; never use `process.exit()` (skips telemetry)
- **Async**: Always await promises (`@typescript-eslint/no-floating-promises`)
- **Naming**: Unused args prefix with `_`, descriptive names (e.g., `commitCreateAction`, `TContext`)
- **Formatting**: Prettier with 2-space indent, single quotes, semicolons, trailing commas (ES5)
- **Console**: No `console.log` (`no-console` error) - use proper logging/output mechanisms
