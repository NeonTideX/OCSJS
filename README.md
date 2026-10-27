# OCSJS V1

An independent browser study and exercise assistant. Six platform adapters share a native runtime with no production dependencies, upstream desktop service, external UI framework or CDN resources.

[Install standard userscript](https://github.com/NeonTideX/OCSJS/releases/latest/download/ocs.user.js) | [Install Custom Providers variant](https://github.com/NeonTideX/OCSJS/releases/latest/download/ocs.common.user.js) | [Release assets](https://github.com/NeonTideX/OCSJS/releases/latest)

## What it does

- Plays video/audio with speed, volume, pause/resume and timed stop controls.
- Navigates visible course items and optionally pages through documents.
- Extracts questions, options, blank fields and image URLs across accessible frames.
- Searches local notes, configurable JSON APIs and OpenAI-compatible endpoints.
- Resolves single/multiple choices, judgement questions and ordered blanks.
- Presents results for review and applies answers through native input events.
- Supports optional save/next controls, settings import/export and a bounded answer cache.
- Provides an English, isolated panel with study, exercises, search, settings and event logs.

| Platform | Main domains |
| --- | --- |
| Chaoxing / Xuexitong | `chaoxing.com`, `xueyinonline.com`, `xuexi365.com` and configured institution domains |
| Zhihuishu | `zhihuishu.com`, `hike-teaching-center.polymas.com` |
| ICVE | `course.icve.com.cn`, `mooc.icve.com.cn`, `ai.icve.com.cn`, `courshare.cn`, `webtrn.cn` |
| ZJY / Vocational Cloud | Remaining `icve.com.cn` hosts |
| iCourse / China University MOOC | `icourse163.org` |
| Yuketang / Rain Classroom | `yuketang.cn`, `gdufemooc.cn`, `xuetangx.com` |

## Installation and first use

1. Install Tampermonkey or ScriptCat in a modern browser.
2. Install one userscript variant from the links above. Standard permits same-origin/loopback providers; Custom Providers adds wildcard API-host permission.
3. Open a supported course page. The OCSJS V1 panel appears at the upper right.
4. In **Settings**, configure a local bank or a provider. See [provider examples](docs/PROVIDERS.md).
5. Use **Start study**, **Start exercises**, or **Search answers**. Review exercise results and choose **Apply answer**.

Automation does not start until you select Start. Automatic application, course navigation, document paging and save actions are off by default. Site verification and trusted-input restrictions may require a page interaction. Check answers and platform persistence before saving or submitting.

The rewrite keeps version **1.0.0 / V1**. If upgrading from OCSJS Extended, export its settings first, disable that installation, and install V1 manually. The new name creates separate manager storage in some managers. Import converted providers and settings into V1; the previous installation and its credentials stay available for reference. Equal version numbers may not trigger an automatic update.

## Development

Requires Node.js 24 or newer and pnpm 12.14.0.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:browser
```

`pnpm check` runs the English/source audit, strict TypeScript checking, unit/regression tests and the production build. Browser tests use an isolated installed Edge on Windows, `PLAYWRIGHT_BROWSER_PATH` when provided, or Playwright Chromium on other systems. On Linux, install Chromium for the pinned playwright-core version with `pnpm exec playwright-core install --with-deps chromium`.

`pnpm dev` watches TypeScript sources. Restart it after changing CSS or platform metadata. Generated outputs live in `dist/`; edit `src/` instead.

| Output | Purpose |
| --- | --- |
| `ocs.user.js` / `ocs.meta.js` | Standard installable userscript and metadata |
| `ocs.common.user.js` / `ocs.common.meta.js` | Custom-provider variant and its metadata |
| `SHA256SUMS` | SHA-256 manifest for scripts, metadata and license files |

## Documentation

- [Architecture and lifecycle](docs/ARCHITECTURE.md)
- [Feature inventory and migration boundaries](docs/FEATURES.md)
- [Providers and connection protocol](docs/PROVIDERS.md)
- [Settings reference](docs/SETTINGS.md)
- [Contributing](CONTRIBUTING.md) and [release procedure](RELEASING.md)

The original 164 resolver fixtures are retained. Integration tests run the built userscript against representative native markup for all six adapters, plus cancellation, route changes, frames, selection and panel behavior. They do not establish access to authenticated courses, live-site compatibility for every variant, or server-side course completion.

Some historical behavior is intentionally omitted: upstream desktop-only actions, executable provider handlers, automatic font-bitmap recognition, random discussion posting and progress overrides. See the feature inventory before upgrading.

## License

GPL-3.0-or-later; see [LICENSE](LICENSE). Historical OCSJS MIT copyright and permission notices remain in [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES/THIRD_PARTY_NOTICES.md). Runtime development, updates, documentation and support are maintained in this repository. GitHub may retain fork-network metadata separately from runtime independence.
