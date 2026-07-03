---
description: Load the codebase module map instead of re-exploring the repo. Use at session start or before asking "where does X live?"
---

# Orient

Load the repo orientation map so you don't spend tokens re-discovering the codebase structure.

## Steps

1. Read `.claude/MODULE_MAP.md`. It contains: package layout, every `apps/web/src/lib/` module with its services and Firestore collections, route groups, Cloud Function triggers, and canonical exemplar files for common patterns.

2. Answer the question (or continue the task) from the map. Only fall back to grep/Explore if the map doesn't cover it — and if it doesn't, that's a map gap:

3. **Keep the map current.** If during this session you add/move/rename a module, service, route, or Cloud Function — or discover the map is wrong or missing something — update the relevant line in `.claude/MODULE_MAP.md` and bump its "Last verified" date. The map only saves tokens if it stays trustworthy.

## Rules

- Do NOT re-verify every map entry with tool calls; trust it unless something contradicts it.
- Do NOT paste large sections of the map back to the user; use it silently.
