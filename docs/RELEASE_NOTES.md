# OCSJS V1

Independent browser runtime rewrite, package version 1.0.0.

- Six platform adapters, native course playback and document navigation.
- Declarative JSON and OpenAI-compatible providers, local answers, persistent bounded cache.
- English review panel, native field updates, pause/resume/stop and stale-result protection.
- No external runtime dependencies, upstream desktop bridge, framework or CDN resources.
- All 164 historical resolver fixtures retained, with additional core and browser regressions.

Install one of `ocs.user.js` or `ocs.common.user.js`. The latter grants custom remote-provider access. Verify files against SHA256SUMS if needed.

Upgrade manually from the historical OCSJS Extended installation: export its settings, disable it, install V1, and import converted configuration. Executable legacy handlers require declarative JSON-path conversion. Automatic font recognition, desktop-only actions, discussion posting and progress overrides are not included. See the repository feature inventory for exact boundaries.

The version stays 1.0.0; same-version updates may require manual reinstallation. This release uses the `v1` tag and leaves the historical `v1.0.0` tag intact. Browser fixtures do not establish compatibility with every authenticated course variant or server-side progress persistence.
