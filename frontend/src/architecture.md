# Architecture

NutKeep frontend is a Next.js 16 App Router app with a feature-based folder structure.

## Layers

| Layer      | Dir           | Responsibility                                                           |
| ---------- | ------------- | ------------------------------------------------------------------------ |
| Routes     | `app/`        | Page components, layouts. No business logic.                             |
| Features   | `features/`   | Domain logic: auth state, dashboard persistence.                         |
| Components | `components/` | Reusable UI, organized by domain (`ui/`, `files/`, `admin/`, `layout/`). |
| Hooks      | `hooks/`      | Shared React hooks for data fetching and state.                          |
| Lib        | `lib/`        | Pure utilities (`utils.ts`) and API client (`api-client.ts`).            |
| Types      | `types/`      | Global TypeScript interfaces (`FileInfo`, `UserInfo`, etc.).             |
| Config     | `config/`     | Constants, tag colors, admin tab definitions.                            |

## Data Flow

```
Route (app/*/page.tsx)
  → Feature Provider (AuthProvider, DashboardProvider)
    → Hook (useFiles, useAuth)
      → lib/api-client.ts (fetch wrapper)
        → Backend API
```

- Auth token stored in `localStorage`, attached via `apiFetch()`.
- Dashboard state (view mode, admin tab) persisted to `localStorage`.
- API base URL from `NEXT_PUBLIC_API_URL` env var.

## Routing

| Path        | Component                     | Auth Required    |
| ----------- | ----------------------------- | ---------------- |
| `/`         | `LandingPage`                 | No               |
| `/login`    | `LoginForm`                   | No               |
| `/files`    | `FilesPanel`                  | Yes              |
| `/settings` | `SettingsPage`                | Yes              |
| `/admin`    | `AdminPanel` + sidebar        | Yes + Admin role |

## Key Rules

- Server Components by default; add `"use client"` only when needed.
- All imports use `@/` path alias.
- No API calls in components — use hooks or api-client directly.
- No prop drilling across more than 2 levels.
