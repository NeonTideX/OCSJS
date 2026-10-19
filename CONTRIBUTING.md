
# Contributing

Contributions to OCSJS Extended should target this repository's `main` branch. This repository is maintained independently from the original OCSJS project.

## Development environment

Required:

- Node.js 26 or later
- pnpm 12.14.0
- Git

Install dependencies from the repository root:

```powershell
pnpm install --frozen-lockfile
```

The project uses a pnpm workspace. Keep dependency changes consistent across package manifests and `pnpm-lock.yaml`.

## Source layout

- `packages/core/` — shared core functionality
- `packages/scripts/` — userscript entry points and integrations
- `packages/utils/` — utility modules
- `scripts/` — build orchestration, TypeScript checks, and stylesheet generation
- `tests/` — automated tests

Prefer source changes over modifying generated files in `dist/`.

## Validation

Run the checks relevant to the change:

```powershell
pnpm lint
pnpm tsc
pnpm test
pnpm build
```

These commands validate JavaScript, run the configured TypeScript checks, execute the resolver test suite, and generate the userscript artifacts.

The answerer test suite requires a local `tests/answerer.config.json`. Use `tests/answerer.config.example.json` to understand its structure. Do not commit credentials, account data, or private test fixtures.

## Contribution workflow

1. Start from the latest `main`.
2. Create a focused branch.
3. Make the change and update tests when appropriate.
4. Run the relevant validation commands.
5. Review the complete diff, including generated and dependency files.
6. Open a pull request against this repository's `main` branch.

Use descriptive commit messages, such as `fix: correct navigation`, `refactor: simplify build pipeline`, or `docs: update development instructions`.

## Engineering guidelines

- Keep changes focused and avoid unrelated modifications.
- Prefer fixing the underlying issue over adding temporary compatibility workarounds.
- Update package manifests and the lockfile together when changing dependencies.
- Keep the build configuration aligned with the currently supported Node.js and pnpm versions.
- Do not commit `node_modules`, generated bundles, local environment files, secrets, or private test configuration.
- Preserve upstream copyright notices and third-party license terms.
- Remove session cookies, access tokens, passwords, and personal information from issue reports and logs.

## License

The project declares GPL-3.0-or-later. Contributions must respect the applicable project and third-party licensing terms.
