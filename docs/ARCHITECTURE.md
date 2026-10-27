# Architecture

OCSJS V1 is a TypeScript application compiled into one browser IIFE. Runtime code uses browser APIs and userscript-manager APIs only. Development tools are not loaded by the installed userscript.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | Per-document startup, route changes, page lifecycle, settings changes |
| `src/platforms.ts` | Six platform definitions, domain ownership, editable selectors |
| `src/core/config.ts` | Validated versioned settings, non-destructive migration, credential-aware export |
| `src/core/task.ts` | Pause/resume/stop, abortable waits, worker concurrency, request rate gates |
| `src/core/text.ts` | Unicode normalization, option labels, answer splitting and comparison |
| `src/core/resolver.ts` | Single/multiple choices, judgement, completion, ambiguity reporting |
| `src/core/network.ts` | Anonymous requests, timeouts, bounded transient retries, response-size limits |
| `src/core/providers.ts` | Declarative JSON providers, local answers, OpenAI-compatible providers, bounded persistent cache |
| `src/core/connect.ts` | Provider-popup protocol with exact source/origin/version checks |
| `src/browser/` | Question extraction, controlled field updates, course navigation and playback |
| `src/ui/` | English Shadow DOM panel, review actions, settings, manual search, diagnostic logs |
| `scripts/` | Deterministic builds, source audit, browser integration checks |

## Session ownership

Study and exercise sessions have separate state machines. Starting a new session aborts its predecessor. Pausing blocks future application of answers; stopping also aborts in-flight requests. Route changes clear exercise results and restart active study discovery. `pagehide` tears down sessions and timers; BFCache `pageshow` creates a fresh runtime.

The parent runtime scans visible same-origin frames. A cross-origin frame can run its own panel when its URL matches the userscript metadata. Web Locks prevent concurrent exercise sessions on the same origin when supported. This is not a cross-origin or distributed lock.

Every bound question has a structural signature containing its type, text, options, blank count and image URLs. The runtime checks it after searching and immediately before applying. Results never carry authority to write into a replacement question.

## Provider boundary

Providers contain JSON data and paths. They cannot execute JavaScript. Requests do not include browser cookies. Cache keys include a SHA-256 fingerprint of the full provider configuration; cache entries expire after seven days and are bounded to 300 questions. User settings and answer cache stay in manager storage.

## Build boundary

The build imports the platform registry to generate matching userscript metadata. Both installable variants embed the same runtime and stylesheet. No runtime `@require`, external stylesheet, CDN font table, desktop bridge or upstream release service is needed. The custom-provider variant adds wildcard network permission; the standard variant grants only self and loopback hosts.

## Verification boundary

Tests exercise the original 164 answer fixtures plus configuration, transport, cancellation and navigation regressions. Browser fixtures use the actual built bundle and native page elements. They establish behavior against representative markup, rather than access to real authenticated courses. Live site changes, server-side progress persistence, trusted-input restrictions and provider answer quality require testing in the relevant account.
