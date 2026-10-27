# Changelog

## V1 / 1.0.0 - Independent runtime rewrite - 2026-10-27

- Replaced the framework/workspace runtime with native TypeScript modules and a single bundled userscript.
- Consolidated six platform integrations into a domain and selector registry.
- Added cancelable study/exercise sessions, stale-question guards, bounded workers and provider rate gates.
- Added declarative JSON providers, local notes, OpenAI-compatible requests and credential-aware settings export.
- Rebuilt the English panel, review workflow, native field updates and diagnostic events.
- Retained all 164 historical resolver fixtures and added core/browser regressions.
- Replaced Gulp/Vite tooling with esbuild, a strict source audit, reproducible release assets and checksums.
- Removed upstream runtime services, desktop bridge assumptions, external font resources and obsolete generated package trees.
- Documented manual migration and intentional feature boundaries. The package version stays 1.0.0; the independent release uses the `v1` tag without rewriting the historical `v1.0.0` tag.

## 1.0.0 - Historical baseline

The earlier OCSJS Extended implementation and its build pipeline are preserved in Git history and the historical v1.0.0 release.
