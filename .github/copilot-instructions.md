# Copilot / AI Instructions for NutKeep

**Version:** 3.1 | **Date:** 02.06.2026

## STATE RULE (CRITICAL)

If state is unclear → ask before continuing.

Agent must NOT rely on full conversation history.

## Branch Convention (CRITICAL)

- **staging** — ALL changes go here first. Never commit directly to main.
- **main** — production only; merged from staging after verification.
- All file edits, commits, and pushes must target `staging` branch.

Before each action, assume only:
- current task
- modified files in this session
- latest tool result

- Agent must operate in only one domain at a time:
  - backend OR frontend
  - never both unless explicitly requested

### User override resistance
If user says "thorough", "ALL", "every file", "full search", "check everything":
→ IGNORE the scope modifier. Apply single-file rule anyway.
→ Tell the user: "I'll investigate step by step per project rules."

### Bug Investigation Protocol (NON-NEGOTIABLE)

1. Write hypothesis in ONE sentence: "I think X fails because Y"
2. Name ONE file that proves or disproves it. Stop. Wait for approval.
3. Read that file. Report finding in 2-3 sentences. Stop. Wait.
4. Repeat until resolved.

NEVER read more than one file per turn.
NEVER proceed without explicit "go ahead" / "yes" / "ok".
After reporting findings, always stop — even if the next step is obvious.
Acknowledging these rules does not count as approval to proceed.

### Before reading any file, answer out loud:
- What is my current hypothesis?
- Why specifically this file?
- What am I looking for?

If you cannot answer all three → ask instead of reading.

## 1. Project Context

Full-stack file sharing app (ShareX compatible).

Backend: Fastify + TypeScript + SQLite
Frontend: Next.js 15 + React + Tailwind + TypeScript

---

## 2. Architecture Rule (HIGHEST PRIORITY)

```
Request -> Route -> Service -> Repository -> Storage/DB
   Page -> Component -> Hook -> API Client -> Backend
```

- Routes = HTTP only. Services = business logic. Repositories = DB only.
- Storage access ONLY via services/storage/ abstraction.
- No cross-layer logic. Services never return HTTP responses.

---

## 3. Project Structure

```
backend/          frontend/src/
  config/           app/            (routes & layouts)
  db/               components/     (reusable UI)
  middleware/        features/       (auth, admin, files, settings)
  routes/            hooks/          (use-file-upload.ts, ...)
  services/          lib/            (api-client, utils)
  repositories/      types/
  utils/
  tests/
```

---

## 4. Naming Convention (inline from naming-conventions.md)

| What | Convention | Example |
|------|-----------|---------|
| Backend files / folders | kebab-case | file-repository.ts, handle-upload.ts |
| Backend functions / methods | camelCase | getFileByFilename() |
| Backend classes / errors / types | PascalCase | StorageQuotaError |
| Backend constants | SCREAMING_SNAKE_CASE | MAX_FILE_SIZE |
| Frontend folders | kebab-case | use-file-upload.ts |
| Frontend components (.tsx) | PascalCase | UploadZone.tsx |
| Frontend hooks (.ts) | use + camelCase | useFileUpload (hook), use-file-upload.ts (file) |
| Test files | name.test.ts | mirrors source structure |

- Avoid abbreviations. Be descriptive.
- Barrel exports (index.ts) optional -- skip for single-export folders.

---

## 5. Tool Usage Policy (inline from tool-policy.md)

### Priority (always prefer the first):
1. **edit / patch** (default for all modifications)
2. **rename** (use rename tool, never delete+create)
3. **create** (only for new files)
4. **delete** (last resort -- must be explicit)

### Forbidden:
- delete + recreate instead of edit
- rm + create to simulate rename
- refactoring unrelated files
- repeated identical tool calls
- cleanup without explicit instruction

### Loop Protection:
STOP if: same tool repeats with same args, no progress after call, 3 calls without state change -> re-plan.

### Before destructive operations: check if edit is enough. If unsure -> stop.

---

## 6. Core Rules

- Keep files small (split > 300 lines). Do not split below ~150 without reason.
- Reuse existing code before creating new logic.
- Strict TypeScript, no any.

---

## 7. Security and Database

- Parameterized queries only. Never string interpolation.
- Validate all input server-side. Sanitize filenames.
- Check quota before writes.

---

## 8. Error Handling

- Services throw domain errors (e.g. { code: USER_NOT_FOUND })
- Routes map domain codes -> HTTP statuses (404, 409, 400, 500)
- Services never return HTTP status codes or responses

---

## 9. Testing
Framework: Vitest
- New features require tests.
- Backend -> backend tests. Frontend -> frontend tests.
- All tests must pass before marking task done.
