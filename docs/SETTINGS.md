# Settings reference

Settings use schema `1`. Saving a partial object fills missing fields with defaults; edit/export the full object to retain other customizations. Saving validates the complete object and cancels active work.

| Key | Default | Meaning |
| --- | --- | --- |
| `playbackRate` | `1` | Native media rate, 0.25 to 16 |
| `volume` | `0.5` | Media volume, 0 to 1 |
| `autoResume` | `true` | Resume paused media while the study session runs |
| `autoNext` | `false` | Move to the next exposed course item after media/document completion |
| `readDocuments` | `false` | Enable timed document paging |
| `documentSeconds` | `15` | Interval between document page actions, at least 3 seconds |
| `stopAfterMinutes` | `0` | Stop study after elapsed minutes; 0 disables |
| `mode` | `"unfinished"` | Skip confirmed completed items; `"all"` reviews sequential items |
| `concurrency` | `2` | Question workers, 1 to 6 |
| `requestIntervalMs` | `1000` | Minimum interval per provider |
| `timeoutMs` | `15000` | Request timeout, 100 to 120000 milliseconds |
| `retries` | `1` | Extra attempts for HTTP 429 and 5xx only, 0 to 3 |
| `cacheEnabled` | `true` | Seven-day, 300-question persistent answer cache |
| `autoApply` | `false` | Apply reliably resolved answers without per-result review |
| `autoSave` | `false` | Click the explicit save selector when every result in a batch was applied |
| `saveSelector` | `""` | Site-specific save-only CSS selector; never set a final-submit control here |
| `advanceQuestions` | `false` | Advance after all batch answers were applied with auto-apply enabled |
| `questionNextSelector` | `""` | Site-specific next-question control |
| `unlockCopy` | `false` | Enable reversible copy/paste assistance |
| `minimized` | `false` | Remember compact panel state |
| `providers` | `[]` | Declarative providers; see PROVIDERS.md |
| `bank` | `[]` | Local answers; at most 10000 |
| `glyphMap` | `{}` | Character substitutions for a known course font mapping |
| `customSelectors` | `{}` | Override keys from the platform selector definition |
| `connectUrl` | `""` | Optional provider connection page |

Supported selector keys: `questions`, `title`, `options`, `blanks`, `chapters`, `active`, `completed`, `next`, `documentNext`, `captcha`. Keep selectors specific to the active course area. An empty optional selector disables that action. Broad educational-domain installation patterns only select the Chaoxing adapter; a panel appearing there is not a guarantee that the page uses Chaoxing markup.

Configuration export excludes headers, request data, URL queries and the connection URL by default. Choose **Export with credentials** for a complete private backup. Review imports before saving. Legacy values and wrappers are retained; only recognizable playback speed/volume values are read during first startup.
