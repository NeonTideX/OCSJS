# OCSJS Extended

A TypeScript-based browser userscript project for automating supported online-course workflows.

This repository contains shared utilities, platform-specific integrations, build scripts, and tests. Its structure separates reusable functionality from site-specific behavior to make ongoing maintenance easier.

## Project Structure

- `packages/` — shared packages and platform-specific script implementations
- `packages/scripts/src/projects/` — platform-specific integrations
- `packages/scripts/src/utils/` — shared helper modules
- `scripts/` — build and development scripts
- `tests/` — automated tests
- `dist/` — generated build output

## Requirements

- Node.js 26.0.0 or later
- pnpm 12.14.0 (pinned in the root package.json)
- A compatible userscript manager, such as Tampermonkey or ScriptCat, if you intend to run a generated userscript in your browser

## Build from Source

Open a terminal in the repository directory and run:

```powershell
pnpm install --frozen-lockfilepnpm build
```


Generated files are placed in the configured build output directory. Use the generated bundle intended for your userscript manager; do not edit generated files as a substitute for changing the source code.

## Tests

Run the core checks from the repository root:

```powershell
pnpm lint
pnpm tsc
pnpm build
pnpm test
```

Individual test files may have separate commands. Check `package.json` and the relevant test file before running additional tests.

## Development

When modifying platform-specific behavior, start by looking under `packages/scripts/src/projects/`. Shared behavior and helper functions may be located under `packages/scripts/src/utils/`.

Before submitting changes, review the diff and run the relevant tests and build steps for the code you changed.

## License

This repository declares **GPL-3.0-or-later** for the project as a whole. Portions inherited from upstream OCSJS retain applicable copyright and licensing notices.

See `LICENSE` for the project license. The original MIT license and third-party notices are preserved in `THIRD_PARTY_LICENSES/`.