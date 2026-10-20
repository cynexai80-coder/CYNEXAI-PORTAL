# Server layer plan (closes the "class B" security items)

Status: **plan only — nothing implemented.** It needs two answers from you (bottom) before work starts.

## 1. What is wrong today (verified in the code, 20 Oct)

- The browser talks to the database directly. `src/lib/turso.ts` builds a libSQL client from `VITE_TURSO_AUTH_TOKEN`, so the token is inside the published JavaScript. Anyone who opens DevTools can read or write **every table** (users, salaries, payments, leads, answer keys).
- **615 raw SQL call sites** in 28 API modules (`src/lib/api/*`) plus 16 components that import the client themselves.
- Login (`src/lib/auth.ts`) is checked in the browser; the "session" is plain JSON in `localStorage` (`erp_session_token`). Editing `role` to `CEO` is accepted by `RequireAuth`.
- Passwords are AES-encrypted with a key that also ships in the bundle (`VITE_APP_SECRET`), and `password_hash` holds the same reversible value.
- Server-side code today: two Netlify functions (`create-order`, `verify-payment`) and the Express WhatsApp/voice service (`backend/`, Render).

Consequence: roles are cosmetic. The UI hides pages, but the data is open.

## 2. Target

```
Browser (UI unchanged)                    Netlify Functions                      Turso
  login form  ───────────────►  /api/auth/login   (verify, set signed cookie)
  src/lib/turso.ts "client"  ──►  /api/db          (check cookie → role → policy)  ──►  DB (token lives only here)
  public forms ──────────────►  /api/db            (public allowlist, rate-limited)
```

Key idea: **keep every `src/lib/api/*` function and every page exactly as is.** Only the object exported as `client` changes: instead of opening a direct libSQL connection it posts `{sql, args}` (or a batch) to `/api/db`. 615 call sites stay untouched, and the Turso token disappears from the bundle.

## 3. Stages

### Stage 1 — Real login and sessions
- `POST /api/auth/login`: loads the user, verifies the password **on the server**. For legacy rows it decrypts the old AES value with the key from the server environment; on success it stores a bcrypt/argon2 hash (lazy migration, no forced reset). Rate-limited per email + IP.
- Issues a signed session cookie (HMAC-SHA256 token with `id`, `role`, `exp`; `HttpOnly; Secure; SameSite=Lax`, 12 h). `GET /api/auth/me`, `POST /api/auth/logout`.
- `src/lib/auth.ts`: `login()` calls the function; the `localStorage` copy stays only as a UI cache. `RequireAuth` still guards routes for UX, but the server is now the authority.
- Done when: editing `localStorage` to `role: CEO` no longer gets any data; wrong passwords and locked accounts are rejected server-side; legacy accounts still log in.

### Stage 2 — Authenticated database proxy with a role policy (the big one)
- `POST /api/db` accepts one statement or a batch. It: verifies the cookie → parses the SQL (a SQLite parser, **fail closed** on anything it cannot parse; no multi-statement strings, no `PRAGMA`, `ATTACH`, `DROP`, `ALTER` from clients) → extracts tables and verb → checks `policy[role][table][verb]` → runs it with the server-side token.
- Policy lives in one reviewable file (`netlify/functions/dbPolicy.js`): per role, which tables may be read/written, plus **column deny-lists** (never return `password_*`, document blobs, salaries to roles that should not see them).
- Row scoping for students and teachers on the sensitive tables (`student_progress`, `attendance_logs`, `test_results`, …): the proxy requires the caller's own id in the statement parameters or rewrites the `WHERE`. This is the part that needs the most care and tests.
- Public (not logged in) allowlist: read courses/blog/certificates (limited columns, verification only), insert into `leads` / pre-registration / newsletter with size limits and a rate limit. No reads of other people's rows.
- Client: `turso.ts` exports a `client` with the same `execute` / `batch` shape that calls `/api/db`. The existing retry and circuit-breaker wrapper stays.
- Remove `VITE_TURSO_AUTH_TOKEN` and `VITE_APP_SECRET` from the browser build; set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET` as **server-only** Netlify variables.
- Done when: the bundle contains no token (`grep` the built `dist`), a Sales session cannot read `users.salary` or write `users`, a Student session cannot read another student's rows, and the full unit + e2e suites pass against the local test database through the proxy.

### Stage 3 — Move trust-critical logic behind named endpoints
Order by risk: coins/scoring and answer grading (answer keys stop being sent to students), attendance verification, AI/voice key proxy (Groq, Gemini, Deepgram), payment reconciliation (match `order → student/sale → amount`), sandboxed code runner (replace `eval()`), CAPTCHA on public forms. Each is a small endpoint plus a small client change.

## 4. How it is tested without touching production
- Functions are plain Node handlers; unit-test them with Vitest against an in-memory libSQL database (same approach as the local test DB already used for browser checks).
- Add a Vitest suite for the policy: a table of `(role, SQL) → allowed/denied`, including injection attempts, multi-statement strings and parser failures.
- `netlify dev` (or a Netlify deploy preview) for an end-to-end pass with the seeded local DB; production is only touched by a normal deploy after a preview passes.

## 5. Risks and how they are contained
- **A policy that is too strict breaks a page.** Mitigation: ship Stage 2 in *log-only* mode first (proxy allows everything but logs what the policy would have denied), run the app through every role, then switch to enforce.
- **Latency.** One extra hop (Netlify function → Turso). Batches stay batches; reads can keep the existing query cache.
- **Rollback.** A flag (`VITE_DB_MODE=direct|proxy`) keeps the old direct path available during the migration; it is removed once the proxy is stable.
- **Parser gaps.** Fail closed, and keep a short allowlist of hand-reviewed statement shapes for anything the parser cannot read.

## 6. What it does not fix by itself
Product decisions (D-1…D-8 in `OPEN_ISSUES.md`), the 297 type errors, accessibility work, and the logic bugs in the data layer. It also does not make a *stolen valid session* harmless; that is normal session security (expiry, logout, rotation).

## 7. Decisions needed from you
1. **Approach:** proxy-first (Stage 1 → 2 → 3, recommended: fastest way to take the token out of the browser and make roles real) or a full per-module API rewrite (cleaner, but 615 call sites; weeks, not days).
2. **Passwords:** lazy re-hash on next login (recommended, nobody is locked out) or force everyone to set a new password at first login after the switch.
Also needed at deploy time (yours): add the three server-only variables to the Netlify site and confirm which hostnames serve the app (`cynexai.in`, `ops.cynexai.in`), since the cookie is host-scoped.
