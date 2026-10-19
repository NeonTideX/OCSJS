
# OCSJS Extended

An independently maintained fork of [OCSJS](https://github.com/ocsjs/ocsjs), with a modernized userscript build toolchain.

## Requirements

- Node.js 26 or later
- pnpm 12.14.0
- A browser userscript manager, such as Tampermonkey or ScriptCat

## Build

Run these commands from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm build
```

The build script configures the output path automatically. No manual `VITE_BUILD_PATH` setting is needed.

Generated userscripts are written to `dist/`:

- `ocs.user.js` — standard userscript
- `ocs.common.user.js` — common variant with broader `@connect` permissions
- `ocs.dev.user.js` — development build
- `ocs.meta.js` — userscript metadata

Import the appropriate generated userscript into your userscript manager. Review its requested permissions before enabling it. Do not edit generated files directly; change the source under `packages/` and rebuild.

## Development and tests

```powershell
pnpm lint
pnpm tsc
pnpm build
pnpm test
```

- `pnpm lint` checks JavaScript code.
- `pnpm tsc` runs the configured TypeScript checks.
- `pnpm build` builds the packages and generates userscripts.
- `pnpm test` runs the resolver test suite.

The optional `pnpm test:answerer` suite requires a local `tests/answerer.config.json`. See `tests/answerer.config.example.json`; do not commit credentials or private test data.

## Project structure

- `packages/core/` — core functionality
- `packages/scripts/` — userscripts and platform integrations
- `packages/utils/` — shared utilities
- `scripts/` — build tooling
- `tests/` — automated tests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report bugs and propose improvements through the [issue tracker](https://github.com/NeonTideX/ocsjs/issues).

## License and attribution

The root `LICENSE` declares GPL-3.0-or-later for this project. The original OCSJS MIT license and copyright notice are preserved in `THIRD_PARTY_LICENSES/OCSJS-MIT.txt`.

This is an independently maintained fork and is not an official release endorsed by the original maintainers.
