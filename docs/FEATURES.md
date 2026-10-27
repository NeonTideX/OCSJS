# Functional inventory and migration map

This inventory was made from the previous core worker, answer wrappers, common/background modules, six platform projects, font utilities and build scripts. The old source remains recoverable from Git history before the V1 rewrite.

| Previous responsibility | V1 implementation | Boundary |
| --- | --- | --- |
| Chaoxing, Zhihuishu, ICVE, ZJY, iCourse and Yuketang routing | One ordered domain/selector registry | Account-specific markup may need custom selectors |
| Video and audio playback, speed, volume, resume | Native single-player study controller | The browser or site may require a manual Play gesture |
| Course item selection, completed-item filtering, review mode | Shared chapter navigator with unfinished/all modes | Only exposed DOM items are actionable; expand a collapsed outline |
| PPT/document reading | Timed next-page controls | Does not fabricate server-side completion |
| Timed study stop | Configured wall-clock stop interval | Includes paused elapsed time |
| Homework, exams, chapter questions, mixed page layouts | Shared question extraction and optional next-question/save selectors | Review remains enabled by default; submission is a user action |
| Single, multiple, judgement and completion matching | Independent deterministic resolver | Historical 164 fixtures retained |
| Rich-text, textarea and controlled framework inputs | Native value setters and input/change events | Cross-origin editor bodies are inaccessible |
| Images embedded in questions and answers | Image-aware extraction and optional image URLs for providers | Local/private image URLs may be inaccessible to a provider |
| Remote font-reference download and glyph decoding | User-supplied glyph map | Automatic font-bitmap recognition is not included |
| Custom question-bank requests and API headers | Declarative JSON requests, templates and response paths | Executable legacy handlers require conversion |
| AI answer services | User-configured OpenAI-compatible chat endpoint | No bundled model, subscription or account dependency |
| Provider connection popup | Versioned source/origin-checked protocol | No default external provider |
| Question cache and results | Bounded persistent cache, review cards and JSON export | Cached answers are not proof of correctness |
| Global settings and namespace migration | One schema with validated import/export; old values retained | Provider credentials are never automatically reinterpreted |
| Floating controls, iframe controls and minimization | Isolated English panel per accessible document tree | Cross-origin frames use independent controls |
| Copy/paste assistance | Optional reversible capture listeners and selection styles | Site listeners registered earlier can still take precedence |
| Debug/request console | Bounded application event log | Raw requests, responses, page credentials and general traffic are not recorded |
| Upstream desktop Playwright bridge and login/config sync | Removed runtime requirement | Operations requiring trusted input stay with the user |
| Random discussion replies, forced page hacks, completion/progress overrides | Omitted | Discussion content, account verification and final submission remain user actions |
| Upstream update banners, community links, helper downloads | Own repository release links | Historical copyright notices remain |
| Gulp, workspace compilation, duplicate lib trees, bundle visualizer reports | One esbuild build with checksums | Generated artifacts are release assets, rather than source |

The rewrite covers the main browser study and exercise workflows. It does not claim complete behavior parity for every historical hack or every live course variant. The explicit omissions above are intentional implementation boundaries and must be considered when upgrading.
