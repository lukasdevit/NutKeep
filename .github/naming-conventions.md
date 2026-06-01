# Naming Convention – NutKeep

**Version:** 1.3 | **Date:** 31.05.2026 | **Applies to:** Backend + Frontend

The goal is consistency, code readability, and predictable AI behavior during refactors.

---

## 1. General Rules

- Consistency across the entire project is the top priority.
- All new files and folders must follow this convention. Rename when refactoring.
- Group related files into feature folders only for a single domain or user action.
- Naming rules are global and do not depend on folder location.
- AI must follow these rules — never introduce new naming styles.

---

## 2. Backend (TypeScript)

| What | Convention |
|---|---|
| Folders / Files | `kebab-case` |
| Functions / Methods | `camelCase` |
| Classes / Errors | `PascalCase` |
| Types / Interfaces | `PascalCase` |
| Constants | `SCREAMING_SNAKE_CASE` |

### Example

```text
services/
  file-service.ts
  upload/
    handle-upload.ts
    finalize-upload.ts

repositories/
  file-repository.ts
  user-repository.ts
```

---

## 3. Frontend (Next.js + React)

| What | Convention |
|---|---|
| Folders | `kebab-case` |
| Components (`.tsx`) | `PascalCase` |
| Other files (`.ts`) | `kebab-case` |
| Hooks | `use` + `camelCase` |
| Types / Interfaces | `PascalCase` |
| Variables / State | `camelCase` |

### Example

```text
src/
  components/
    ui/
    FileCard.tsx
    UploadZone.tsx
  features/
    upload/
      UploadForm.tsx
      use-file-upload.ts
```

---

## 4. Additional Rules

- Avoid abbreviations (`svc`, `upld`, `chk`).
- Names must be descriptive — clarity over brevity.
- Barrel exports (`index.ts`) are optional — avoid in single-export folders.
- Test files: `name.test.ts`, mirror source structure where possible.