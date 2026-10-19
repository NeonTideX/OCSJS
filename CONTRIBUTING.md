
# Contributing

Contributions to OCSJS Extended are welcome.

## Development

Requirements: Node.js 26 or later and pnpm 12.14.0.

Install dependencies from the repository root:

```powershell
pnpm install --frozen-lockfile
```

Before submitting a change, run the relevant checks:

```powershell
pnpm lint
pnpm tsc
pnpm build
pnpm test
```

The optional answerer tests require a local `tests/answerer.config.json`. Use `tests/answerer.config.example.json` as a reference, and do not commit credentials or private test data.

## Workflow

1. Create a focused branch from the latest `main`.
2. Make the change and update tests when appropriate.
3. Run relevant checks and review the diff.
4. Open a pull request against this repository's `main` branch.

Use clear commit messages, such as `fix: correct navigation` or `docs: update setup instructions`.

## Guidelines

- Prefer source changes over edits to generated files in `dist/`.
- Keep changes focused and explain meaningful behavior changes.
- Do not commit `node_modules`, generated output, local environment files, secrets, or unrelated personal configuration.
- Preserve applicable copyright notices and third-party license terms.
- Remove session cookies, access tokens, passwords, and personal information from issue reports and logs.

## License

The project declares GPL-3.0-or-later. Contributions must respect the project license and applicable third-party licensing obligations.
