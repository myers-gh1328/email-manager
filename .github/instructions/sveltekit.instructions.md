---
applyTo: "src/routes/**/*.svelte,src/routes/**/+page.server.ts,src/lib/server/**/*.ts,tests/**/*.ts"
---

# Training Communications Studio Implementation Instructions

Follow `AGENTS.md` and `docs/ARCHITECTURE.md`.

- Keep server-only behavior under `src/lib/server`.
- Keep SQLite SQL inside `src/lib/server/repository/`.
- Preserve campaign delivery send-once behavior.
- Do not expose decrypted secrets to browser load data or logs.
- Keep route-specific form actions in the owning `+page.server.ts`.
- Use grouped settings actions instead of broad save-everything actions.
- Add focused tests for changed invariants.
- Run `npm run agent:check` before completion.
