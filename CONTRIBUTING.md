# Contributing

Thank you for your interest in contributing to OCSJS Extended.

This project welcomes improvements that make the codebase more useful, reliable, maintainable, and easier to develop. Contributions are evaluated according to their technical quality, compatibility, scope, and applicable legal and licensing requirements.

This repository maintains its own contribution guidelines. Policies from the original project do not automatically apply here.

## What You Can Contribute

Contributions may include:

- Bug fixes and performance improvements
- New features and workflow automation
- Support for additional online-course platforms
- AI-related integrations and functionality
- Refactoring and developer tooling
- Documentation improvements and automated tests

You may open an issue to discuss a proposal before implementing it, especially when the change is large or affects shared architecture. Prior discussion is encouraged when useful, but is not a mandatory prerequisite for every contribution.

## Reporting Issues

When reporting a bug, include as much relevant information as practical:

- The affected platform and the steps needed to reproduce the problem
- Your browser and userscript manager versions
- The project version or commit you are using
- Expected behavior and actual behavior
- Relevant error messages, logs, or screenshots

Remove passwords, access tokens, session cookies, personal information, and other sensitive data before sharing diagnostic material.

For feature requests, describe the use case, the intended result, and any relevant technical constraints.

## Development Environment

See `README.md` for project structure, requirements, and build instructions.

The project uses TypeScript, pnpm, and a collection of shared utilities and platform-specific integrations.

Install dependencies from the repository root:

```powershell
pnpm install --frozen-lockfile
```

For the current Windows build setup:

```powershell
$env:VITE_BUILD_PATH = "../../dist"
pnpm build
pnpm test
```

The configured test command runs the tests specified by the project configuration. When changing a specific feature, run the relevant tests as well.

## Development Workflow

1. Start from the latest `main` branch.
2. Create a branch for your changes.
3. Keep changes focused and explain their purpose.
4. Run relevant tests and build checks.
5. Review your diff before committing.
6. Open a pull request against this repository's `main` branch, describing the changes and the checks performed.

Suggested branch names:

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `docs/short-description` — documentation
- `refactor/short-description` — refactoring

Pull requests should explain what changed, why it is needed, and any known limitations. Include reproduction steps for bug fixes where practical.

## Code and Repository Guidelines

- Follow the existing code style and TypeScript conventions.
- Keep changes relevant to the intended task.
- Add or update tests when appropriate.
- Do not commit `node_modules`, generated build output, local environment files, secrets, or unrelated personal configuration.
- Avoid editing generated files when the corresponding source files are available.
- Preserve applicable copyright notices and third-party license terms.
- Do not include credentials, private user data, or other sensitive information in source code, commits, or issue reports.

New platform integrations, automation approaches, and AI-related features are welcome for review. Acceptance depends on the quality and compatibility of the implementation rather than blanket exclusions based solely on feature category.

## Commit Messages

Use clear, descriptive commit messages. Conventional Commits are recommended:

```text
feat: add support for a new course workflow
fix: correct cross-chapter navigation
docs: improve setup instructions
refactor: simplify platform integration
test: cover navigation edge cases
```

Keep each commit focused on a coherent change.

## License

The project is intended to use GPL-3.0-or-later. Contributions must respect the applicable project license and existing third-party licensing obligations.

See `LICENSE` and `THIRD_PARTY_LICENSES/` for license information.

## Code of Conduct

Be respectful, constructive, and professional when discussing issues or reviewing contributions. Technical disagreements should focus on evidence, implementation quality, and the needs of the project.