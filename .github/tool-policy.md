# Tool Policy – linqoy AI Agent

**Version:** 2.0 | **Date:** 31.05.2026

---

## 1. CORE RULE

If unsure → choose EDIT (never delete or recreate).

---

## 2. TOOL PRIORITY

1. edit / patch (default)
2. rename
3. create
4. move
5. delete (last resort)

---

## 3. RULES

- Always prefer edit over delete + recreate
- Rename ONLY via rename tool
- Never recreate existing files
- One tool call = one atomic action
- No repeated identical tool calls

---

## 4. FORBIDDEN

- delete + recreate instead of edit
- mass renames in one step
- refactoring unrelated files
- restructuring folders without request
- “cleanup” operations without explicit instruction

---

## 5. RENAME RULE

- Always use rename tool
- Never simulate rename via delete/create

---

## 6. LOOP PROTECTION

STOP if:
- same tool repeats with same args
- no progress after tool call
- 3 tool calls without state change

Then:
→ pause and re-plan

---

## 7. SAFETY RULE

Before destructive actions:
- check if edit is enough
- if unsure → stop