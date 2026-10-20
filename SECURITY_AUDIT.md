# CynexAI Portal – Security & Logic Audit

Scope: `cynexai-website` (React + Turso + Netlify functions + Express backend).
Method: targeted review of auth, every API module's patterns, routes, backend, payments, scripts, config. NOT a line-by-line read of all ~57k lines. "Same pattern" = modules share the same architecture, so the finding applies there too.

Status key: ✅ fixed in working tree (not committed) · 🟡 open, needs a decision · 🔴 open, needs the server-side migration

---
## 1. Critical

| # | Area | Finding | Status |
|---|------|---------|--------|
| C1 | Architecture | Turso DB token (`VITE_TURSO_AUTH_TOKEN`) is bundled into the browser. Anyone can read/write the entire DB (users, salaries, payments, leads). | 🔴 Move DB access behind server functions |
| C2 | Auth | Login is checked in the browser; session is plain JSON in `localStorage` (`erp_session_token`). Editing it to `role:"CEO"` is trusted by `RequireAuth`. | 🔴 Server-issued signed session |
| C3 | Auth | Backdoors: `admin123` master password for blank/undecryptable accounts, hardcoded per-email password, ciphertext accepted as password, fallback CEO/Admin accounts when DB unreachable. | ✅ Removed (dev-only demo accounts under `vite dev`) |
| C4 | Secrets | Turso tokens + Razorpay secret hardcoded in 20+ tracked files (incl. shipped `turso.ts`). | ✅ Moved to env. **Still in git history → ROTATE** |
| C5 | Secrets | Gemini, Groq, Bunny, app-secret keys are `VITE_*` (shipped to every visitor). | 🔴 Proxy AI calls server-side; delete unused Bunny keys |
| C6 | Passwords | "Encrypted" with AES using a key that ships in the bundle; column `password_hash` stores the same reversible value. Admin UI shows plaintext passwords. | 🔴 Hash (argon2/bcrypt) + replace "show password" with "reset password" |
| C7 | PII in git | `Student_Data.xlsx`, `students_seed.json`, credential-dump scripts were tracked. | ✅ Untracked + ignored. **Still in history** |
| C8 | Backend | `/api/whatsapp/send`, voice-interview (paid Groq/Deepgram) and order endpoints had open CORS and no limits. | ✅ CORS allowlist, rate limits, validation, 10 MB upload cap. (No auth yet – see C2) |

## 2. High

| # | Area | Finding | Status |
|---|------|---------|--------|
| H1 | Authz | API layer (`src/lib/api/*`) has almost no permission checks (only tasks/whatsapp/projects/materials/activities). Any logged-in user (or anyone with the DB token) can call `deleteUser`, `saveUser`, `awardCoinsManually`, etc. Role checks live only in the UI. | 🔴 Server-side role checks |
| H2 | Authz | `RequireAuth`: when a route is in `ROUTE_MODULE_MAP` and module access ≠ none, `allowedRoles` is skipped. This lets CEO-granted module permissions override role. Probably intended, but it means permissions_json (client-editable) is the only gate. | 🟡 Confirm intent |
| H3 | Mass assignment | `patchUser` built `SET <key> = ?` from arbitrary object keys (could change `role`, `password_*`, or inject column names). | ✅ Allowlist of columns |
| H4 | Logic | `saveUser`/`saveStudent` reset an existing user's password to `cynex123` when the password field was blank. | ✅ Keeps existing password |
| H5 | Logic/Data | `recordSale` did 3 separate writes (sale, lead status, approval task) – a failure left inconsistent data. | ✅ Now one atomic batch |
| H6 | Payments | `create-order` accepts the amount from the client; no server-side price. `verify-payment` only checks the signature, never matches order→student/sale or amount. | 🔴 Price from DB + webhook reconciliation |
| H7 | Payments | Signature comparison used `===`; no max amount. | ✅ timing-safe compare + amount cap |
| H8 | Code exec | Student JS runs via `eval()` in the app origin (`compiler.ts`) → can read the session and the DB token. | 🔴 Run in sandboxed iframe/worker |
| H9 | Gamification | Coins/points are awarded client-side with no limits: `saveQaResponse` gives +5 coins per correct submit (farmable by repeating), `awardCoinsManually` accepted any number. Quiz/SQL-test scores are computed in the browser and trusted. | ✅ coin amount bounded; 🔴 server-side scoring + once-per-question |
| H10 | Attendance/Progress | `markClassWatched` and attendance (≥5 min, QR) are client-reported → spoofable. | 🔴 Server validation |
| H11 | Public writes | Public forms (lead capture, pre-registration, enroll, contact) write straight to the DB from the browser: no captcha, rate limit, or validation. | 🔴 Server endpoint + captcha |

## 3. Medium

| # | Area | Finding | Status |
|---|------|---------|--------|
| M1 | Passwords | Approval flow generated `cnx` + 4 random digits via `Math.random` (guessable). | ✅ Crypto-random, longer |
| M2 | Passwords | New users default to password `cynex123`. | 🟡 Force password choice |
| M3 | Placement page | `/placementdashboard` has its own hardcoded login (`cynexai800` / `admin123`) stored as a localStorage flag; its data ships in the bundle anyway. | 🟡 Remove gate or make real |
| M4 | Secrets in storage | CEO Settings / Profile store DB token and OpenAI/Groq keys in `localStorage`. | 🟡 Remove; use server config |
| M5 | Uploads | Student documents stored as base64 in the DB with no size/type validation. | 🔴 Object storage + validation |
| M6 | IDs | IDs/codes use `Date.now()` / `Math.random()` (collisions possible, e.g. student codes `CNX-YYYY-####`). | 🟡 Use `crypto.randomUUID()` |
| M7 | Data integrity | Many calls swallow errors (`catch {}`) or return mock success when DB is "not configured" (e.g. `submitSQLTest`) → silent data loss. | 🟡 Surface errors |
| M8 | SQL | 17 queries build SQL with template strings (mostly `SET` clauses from object keys). Values are parameterised; column names are not everywhere. | 🟡 Allowlist each (done for users) |
| M9 | Headers | No security headers / CSP. | ✅ nosniff, frame, referrer, HSTS added. CSP still open (needs Jitsi/Pyodide/YouTube/Razorpay allowlist) |
| M10 | Logging | ~41 `console.log`/diagnostic logs, some printing DB URL/token status. | ✅ Turso diagnostics removed; rest 🟡 |
| M11 | Frontend→backend | WhatsApp/payment calls hardcode `http://localhost:5000`, so the Render service is not what production uses. | 🟡 Use `VITE_API_URL` |
| M12 | Dependencies | Heavy/unused deps (three.js, spectacle, moment+date-fns, motion+framer-motion, html2pdf). `xlsx@0.18.5` has known vulns. | 🟡 Trim/upgrade |

## 4. Low / Hygiene

- 346 TypeScript errors and 829 ESLint errors; no CI to stop regressions. 🟡
- 12 `target="_blank"` links without `rel` (modern browsers imply noopener). 🟡
- Duplicate/legacy tables (`users` + `erp_users`) kept in sync by hand. 🟡
- Tests touch real DB config if `.env` is present (run with blank DB env). 🟡
- Tracked scratch/one-off scripts (`scratch/`, root `*.mjs/*.cjs`) – move out of the repo. 🟡
- `feature/bunny-stream` branch exists but is NOT in `main` (recordings stay on the YouTube flow). ℹ️

---
## Rotate before pushing
Turso tokens (prod, dev/`cynex-ai-cynexai`, virinchi), Razorpay secret, Groq/Gemini/Deepgram/Bunny keys, `VITE_APP_SECRET` (also re-encrypts passwords), Sandeep's password and any account that used `admin123`/`cynex123`.

## Recommended order for the 🔴 items
1. Netlify Functions: `/api/login` (hash check, signed httpOnly cookie) + `/api/me`.
2. One authenticated `/api/*` per module with server-side role checks; keep `src/lib/api/*` signatures so the UI doesn't change. Start: users, sales/payments, students.
3. Proxy AI/voice keys; server-side quiz scoring and coin awards.
4. Then move to `ops.cynexai.in`.
