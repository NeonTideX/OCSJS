# Contributing

Use English for source, comments, interfaces, documentation, issue reports and commit messages. Keep page text, test fixtures and user-supplied answers in their original language; escape non-English fixture data in source files.

## Workflow

1. Use Node.js 24+ and the pinned pnpm version.
2. Install with `pnpm install --frozen-lockfile`.
3. Edit `src/`, add a regression for changed behavior, and update the relevant documentation.
4. Run `pnpm check`. Run `pnpm test:browser` for browser behavior changes.
5. Open a focused pull request against `main`, including validation and live-site limitations.

Runtime dependencies must remain empty. Platform-specific selectors belong in `src/platforms.ts`; shared workers and UI must not acquire platform-specific service dependencies. Keep request authentication explicit and configuration declarative. Never execute imported JavaScript or record cookies/tokens in diagnostic logs.

Generated bundles, local credentials, private course data, browser profiles and dependency caches do not belong in Git. Preserve project and third-party license notices.
