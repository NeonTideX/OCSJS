# OCSJS Extended

[![CI](https://github.com/NeonTideX/OCSJS/actions/workflows/ci.yml/badge.svg)](https://github.com/NeonTideX/OCSJS/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/NeonTideX/OCSJS)](https://github.com/NeonTideX/OCSJS/releases/latest)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)

An independently maintained fork of [OCSJS](https://github.com/ocsjs/ocsjs), focused on maintaining the userscript codebase and modernizing its build toolchain.

## Overview

OCSJS Extended is organized as a pnpm workspace. The repository contains shared core logic, userscript integration code, utility modules, and build tooling.

The project builds browser userscripts from source rather than maintaining generated bundles as the primary development files.

## Architecture

### Workspace packages

| Path | Responsibility |
| --- | --- |
| `packages/core/` | Core functionality shared by userscript integrations |
| `packages/scripts/` | Userscript entry points and platform-specific integrations |
| `packages/utils/` | Shared utility modules |
| `scripts/` | Build orchestration, TypeScript checks, and stylesheet generation |
| `tests/` | Resolver and other automated tests |

### Build pipeline

The root `build` script invokes the Gulp pipeline defined in `scripts/build-core.js`.

The pipeline:

1. Cleans previous generated output.
2. Runs the resolver test stage.
3. Builds the core and scripts packages with Vite.
4. Generates the stylesheet used by the userscripts.
5. Assembles the final userscript variants and metadata.

The Vite configurations are maintained as `vite.config.mts` to use ESM configuration loading. The build script sets the output path for the Vite builds, so callers do not need to set `VITE_BUILD_PATH` manually.

### Generated artifacts

A successful build writes the generated files to `dist/`.

| Artifact | Description |
| --- | --- |
| `core.js` | Bundled core package |
| `index.js` | Bundled scripts package |
| `style.css` | Generated userscript stylesheet |
| `ocs.user.js` | Standard userscript build |
| `ocs.common.user.js` | Common variant with broader `@connect` permissions |
| `ocs.dev.user.js` | Development userscript variant |
| `ocs.meta.js` | Userscript metadata |

These files are build outputs. Make changes in the source packages and rebuild rather than editing generated bundles directly.

## Toolchain

The repository uses the following development toolchain:

- Node.js 26 or later
- pnpm 12.14.0, pinned through the root `packageManager` field
- TypeScript 7
- Vite 8
- ESLint 10 with flat configuration
- Prettier 3

The exact dependency graph is recorded in `pnpm-lock.yaml`.

## Development

Install the workspace dependencies from the repository root:

```powershell
pnpm install --frozen-lockfile
```

### Validation commands

```powershell
pnpm lint
pnpm tsc
pnpm test
```

Build the production userscripts with:

```powershell
pnpm build
```

The commands serve different purposes:

- `pnpm lint` runs ESLint checks against JavaScript source files.
- `pnpm tsc` runs the configured TypeScript compilation checks.
- `pnpm test` runs the resolver test suite.
- `pnpm build` generates the package bundles, stylesheet, userscript variants, and metadata.

The optional `pnpm test:answerer` suite requires a local `tests/answerer.config.json`. Use `tests/answerer.config.example.json` as a reference. Keep credentials and private test data out of version control.

## Userscript installation

Download the standard [ocs.user.js](https://github.com/NeonTideX/OCSJS/releases/latest/download/ocs.user.js) from the [latest release](https://github.com/NeonTideX/OCSJS/releases/latest), then open or import it with your userscript manager. Release assets include SHA256SUMS and license notices. Alternatively, build the project and select the appropriate file from `dist/`.

For normal use, start with `ocs.user.js`. Use `ocs.common.user.js` only when its broader network permissions are needed. The development variant is intended for development workflows, not as the default production installation.

Review the permissions and behavior of a generated userscript before enabling it in a browser userscript manager.

## Repository conventions

- Edit source files under `packages/` and build tooling under `scripts/`.
- Treat `dist/` as generated output.
- Keep dependency changes synchronized with `pnpm-lock.yaml`.
- Keep workspace and TypeScript configuration consistent with the current toolchain.
- Do not commit local environment files, credentials, or private test configuration.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and contribution requirements.

Report bugs and propose changes through the [issue tracker](https://github.com/NeonTideX/ocsjs/issues).

## Project resources

- [Changelog](CHANGELOG.md) and [Releases](https://github.com/NeonTideX/OCSJS/releases)
- [Contributing](CONTRIBUTING.md), [community conduct](CODE_OF_CONDUCT.md), and [support](SUPPORT.md)
- [Security policy](SECURITY.md) and [release checklist](RELEASING.md)

## License and attribution

The root `LICENSE` declares GPL-3.0-or-later for this project. The original OCSJS MIT license and copyright notice are preserved in `THIRD_PARTY_LICENSES/OCSJS-MIT.txt`.

This is an independently maintained fork. Original copyright notices and applicable third-party license terms must be preserved.
