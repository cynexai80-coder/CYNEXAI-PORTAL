# CynexAI Portal — what is NOT sorted yet

Compiled 20 Oct 2026 from `FULL_AUDIT.md`, `SECURITY_AUDIT.md`, `PAGE_ASSESSMENT.md` (§2, §4.6, §4.7, "Not covered" lists) and a spot-check of the code today.
Nothing here is committed. This file changes no code.

**How to read it**
- **Class A** = code change that keeps the screens/flow. **B** = needs a server layer (login + DB behind functions). **C** = needs *your* decision, not code.
- **Checked** = I confirmed it in the code on 20 Oct. **Doc** = taken from the audit documents, not re-tested (the audits say it was fixed or open; I did not re-verify the "fixed" ones).
- Priority: **P0** do before real users depend on it · **P1** wrong data / money / access · **P2** quality · **P3** polish.

---

## 0. Housekeeping that affects everything

| # | Item | Status | Class | Pri |
|---|---|---|---|---|
| H-1 | **~187 uncommitted changes (157 files, +3319 / −2219)** across all rounds, including deleted files (`src/ApplicationForm.tsx`, `AdminPanel.tsx`, `ApplyForm.tsx`, two `.xlsx`). One mistake and the work is hard to separate or recover. Needs your review, then commits in logical chunks. | Checked | You | P0 |
| H-2 | ~~Two copies of the project.~~ **Settled:** `...\.gemini\antigravity\scratch\cynexai-website` is the real one (tracks `origin/main`); `...\Documents\cynexai-website` is the older copy and is not touched. Archive it when convenient. | Decided | — | done |
| H-3 | ~~Secrets in git history.~~ **Closed by you (20 Oct):** the tokens in the repo/history are demo values; the live ones are in the production Netlify environment. No rotation planned. (If a live value was ever pasted into a commit, that would change; nothing found suggests it.) | Decided | — | done |
| H-4 | ~~`turso.ts` falls back to the production URL~~ — **fixed 20 Oct:** the fallback now applies to production builds only; dev and test runs with an empty env stay unconfigured. `scripts/*.cjs` still hard-code prod/dev URLs (they need credentials from env to do anything). | Fixed | A | done |
| H-5 | ~~`npm run build` syncs the live schema~~ — **fixed 20 Oct:** `scripts/sync_prod_schema.cjs` now runs only when `NETLIFY` is set (or `SYNC_PROD_SCHEMA=1`). The Netlify build behaves as before; a local build no longer touches the live database. | Fixed | A | done |
| H-6 | ~~`package-lock.json` out of sync~~ — **fixed 20 Oct:** `npm install --package-lock-only`; `npm ci --dry-run` now passes. | Fixed | A | done |
| H-7 | Tracked scratch / one-off scripts (`scratch/`, many root `*.cjs/*.mjs/*.py`, `diff.txt`, `dom-dump.html`) clutter the repo and some contain real URLs. | Doc | A | P3 |

## 1. Security and role access (mostly needs the server layer, class B)

**Plan written:** `SERVER_LAYER_PLAN.md` (login + signed session, authenticated DB proxy with a role policy that keeps all 615 SQL call sites unchanged, then trust-critical logic behind endpoints). It waits on two answers from you (approach, password migration). Items S-1…S-3, S-5, S-6, S-8…S-10 below are closed by it.

Roles are enforced **only in the browser**. The session is plain JSON in `localStorage` (`erp_session_token`); anyone can edit it to `role: "CEO"`. I used exactly that to switch roles while testing.

| # | Item | Status | Class | Pri |
|---|---|---|---|---|
| S-1 | **DB token ships in the bundle** (`VITE_TURSO_AUTH_TOKEN`, read in `turso.ts`): anyone can read/write the whole database. | Checked | B | P0 |
| S-2 | **Client-side login and session** (above). Needs a server login with a signed httpOnly cookie. | Checked | B | P0 |
| S-3 | **No server-side permission checks**: `src/lib/api/*` trusts the caller. Delete/save/award functions have little or no role check (`deleteUser` only blocks deleting yourself / the last CEO). | Checked | B | P0 |
| S-4 | `RequireAuth` skips `allowedRoles` when a route has a module permission in `permissions_json` (client-editable). Confirm this is intended. | Doc | C | P1 |
| S-5 | **Passwords are reversibly encrypted** (AES key in the bundle); `password_hash` holds the same value; admin screens can show plaintext; no change-password feature. | Doc | B/C | P0 |
| S-6 | **Payments**: `create-order` accepts the amount from the browser; `verify-payment` checks the signature but never matches order to student/sale/amount; prices and coupons are client-side. | Doc | B | P0 |
| S-7 | **Student code runs with `eval()`** in the app's own origin (`src/lib/compiler.ts:42`): can read the session and DB token. Needs a sandboxed iframe/worker. | Checked | B | P1 |
| S-8 | **Grading, coins, attendance and progress are decided in the browser**; answer keys are sent to students (`correct_answer_idx`, test cases). Scores can be forged. | Doc | B | P1 |
| S-9 | **Public forms write straight to the DB** (lead capture, pre-registration, enroll, contact): no captcha, rate limit or validation. | Doc | B | P1 |
| S-10 | AI/voice keys are `VITE_*` (shipped to every visitor); CEO Settings/Profile store DB token and OpenAI/Groq keys in `localStorage`. | Doc | B | P1 |
| S-11 | Student documents (Aadhaar etc.) stored as base64 in the DB, no size/type check, returned by `SELECT *`. | Doc | B/C | P1 |
| S-12 | `/placementdashboard` has its own hard-coded login (`cynexai800` / `admin123`, `PlacementDashboard.tsx:77`), data ships in the bundle anyway. | Checked | C | P1 |
| S-13 | Default password `cynex123` for new users/students (`users.ts:218,249`, hint text in `UserManagement.tsx:1148`); no forced change. | Checked | C | P1 |
| S-14 | ~~`localhost:5000`~~ — correction: `razorpay.ts` only uses it when the page itself is on localhost (production uses the Netlify functions), so that part was never broken. `ChatPortal.tsx` called it unconditionally: **fixed 20 Oct** — it now reads `VITE_WHATSAPP_API_URL` (dev falls back to localhost:5000; empty in production = "offline" instead of calling the visitor's own machine). **You need to set `VITE_WHATSAPP_API_URL` in Netlify** to the Render service URL and add the site origin to `ALLOWED_ORIGINS` on Render if it is not `cynexai.in` / `ops.cynexai.in`. | Fixed (needs env) | A | done |
| S-15 | CSP **added in report-only mode** (20 Oct, `netlify.toml`): it logs violations in the browser console and blocks nothing. Open the live site, click through the main flows (home, course, pay, student class with Jitsi/YouTube/Python), fix what the console flags, then rename the header to `Content-Security-Policy` to enforce. `unsafe-inline`/`unsafe-eval` stay until S-7 is fixed. | Partly | A | P2 |
| S-16 | Public Jitsi room named after the class id (predictable, no lobby). | Doc | C | P2 |
| S-17 | Mock-test portal `/test`: no login, answers and scoring in the browser, forgeable results. | Doc | B | P2 |
| S-18 | Dev-only demo accounts with `admin123` exist in `src/lib/api/auth.ts` behind `import.meta.env.DEV` (not in production builds). Fine, but keep them out of any staging build. | Checked | — | P3 |
| S-20 | ~~A module permission replaces the role check~~ — **fixed 20 Oct** (`decideRouteAccess`, `RequireAuth`): role defaults no longer open other roles' pages; a module grant adds only that module's own page and only when set explicitly in `permissions_json`. Re-measured: 0 out-of-role pages for Teacher/Sales/DM/Manager (were 68). See `ROLE_ACCESS_MATRIX.md`. | Fixed | done |
| S-21 | ~~Trailing slash or different case skips the module check~~ — **fixed 20 Oct** (path normalised before every lookup; 20 new tests, which fail against the old logic). | Fixed | done |
| S-22 | ~~`/chat` open to every login~~ — **fixed 20 Oct**: CEO, Manager, Sales/HR, DM, Teacher only (Student and Admin get Access Restricted). The leads API itself is still unprotected until the server layer (S-3). | Fixed | done |
| S-23 | ~~Manager can open the CEO's Global Settings~~ — **fixed 20 Oct** with S-20 (verified: Access Restricted). | Fixed | done |
| S-24 | Smaller role issues. **Fixed:** Manager menu "Reports" 404 (new `/manager/reports` route). **Still open:** defaults deny pages the route table allows (Manager: certificates, DM planner, Teacher settings; Teacher: student progress; decision D-6), the Admin role cannot open its own `/admin/dashboard`, "role page access" cannot be changed from anywhere. | A / C | P2 |
| S-19 | ~~Unused heavy dependencies~~ — **20 Oct:** removed three, @react-three/fiber, @react-three/drei, spectacle, motion, gsap, @gsap/react, @lottiefiles/lottie-player (not imported anywhere in tracked code; 286 fewer installed packages; build, tsc, tests unchanged). Left: moment (used by one root script), xlsx@0.18.5 (known vulnerabilities; used by root maintenance scripts only, not the browser bundle). | A | P3 |

**Role access measured 20 Oct — see `ROLE_ACCESS_MATRIX.md`** (7 roles + visitor x 104 routes, real logins, local database). Visitors are handled correctly, but inside the browser the role checks do not match the route table: 66 pages of other roles open by URL for Teacher/Sales/DM/Manager (a Teacher sees revenue and payroll on `/ceo/dashboard`); a trailing slash or different capitalisation skips the module check; students and admins can open the Chat Center and see every lead's phone number; Managers can open the CEO's Global Settings (API-key and database-token fields). S-20…S-23 were **fixed the same day** and re-measured (0 out-of-role pages, was 68); S-24 is partly open.

## 2. Product decisions only you can make (class C)

| # | Decision | Pri |
|---|---|---|
| D-1 | `/about` shows the 404 page (header and footer both link "About Us"; the page was deleted). Restore a page or remove both links. | P1 |
| D-2 | Sales reps can open the company-wide audit log (`/sales/history`) and Course Management. Restrict, or confirm. | P1 |
| D-3 | Sales pitch "What We Send" template is saved in each browser's `localStorage` (`SalesPitchPage.tsx:112`), so a manager's edit never reaches the team. Needs a DB table. | P1 |
| D-4 | "Mark as completed" has no watch requirement (instant completion, streak, progress). | P1 |
| D-5 | CEO dashboard "AI Strategic Advisory" is static text with one live number. Compute a real insight or drop the "AI" label. | P2 |
| D-6 | Teachers do not get the Student Progress module by default. Should they? | P2 |
| D-7 | Admin screens show other users' passwords. Replace with "reset password"? | P1 |
| D-8 | Placement dashboard gate (S-12), default password (S-13), Jitsi room (S-16), document storage (S-11). | P1 |
| D-9 | Should a timetable slot point at one specific class (add `class_id` to `timetable_slots`), or keep deriving "the class being taught" from the course? Today it is derived (F-1). | P2 |

## 3. Functional bugs still open or unconfirmed (class A)

The audit marks most L/T/S/U/P items as fixed in the working tree; I did not re-test them. These were **not** in its fixed list or are only partly fixed:

| # | Item | Status | Pri |
|---|---|---|---|
| F-1 | ~~**L8** a timetable slot always opened the *first* class of the course~~ — **fixed 20 Oct** (`student.ts`): it opens the class being taught (first not-yet-completed, same rule as the teacher's "start class"), or the latest one when the course is finished. A slot still has no class id of its own; linking them properly is a data-model choice (see D-9). Unit test added. | Fixed | done |
| F-2 | **L11** Referrals/leaderboard: `referrals` is never written to; the three student routes just redirect to the dashboard; `Leaderboard.tsx` and `ReferralCenter.tsx` are unreachable and still carry dark-only colours. | Doc | P2 |
| F-3 | **P1 (partly)** DM marketing campaigns/metrics fall back to `localStorage` (`marketing.ts`); jobs/SEO settings were localStorage-only. | Checked (marketing) | P2 |
| F-4 | **Timezone**: "today" computed in UTC (IST 00:00–05:30 is the previous day). **Fixed 20 Oct for the 20 places that read the clock** (tasks, reports, sales dashboard, pipeline, certificates, DM, student dashboard) by using the existing `todayIST()`. Remaining uses convert *given* dates (week arithmetic, CSV file names) and are not wrong. | Fixed | done |
| F-5 | **Identity mismatch**: a student is `users.id`, `students.id` or email depending on the table, so queries OR 3–4 forms (slow, double counts). | Doc | P2 |
| F-6 | Client-side DDL (`ensureAttendanceSchema`, `ensureBatchesTable`, runtime `CREATE TABLE`) disagrees with `schema.json` in places. Needs one migration module plus a CI test on a fresh DB. | Doc | P2 |
| F-7 | **DB failures fail open**: the circuit breaker in `turso.ts` answers every query with an empty result once tripped; only the student dashboard checks `isDbFailed()`. An outage looks like "no data" everywhere else. | Doc | P1 |
| F-8 | Polling load (class page every 3 s per student, attendance matrix reads the whole table every 8 s), `getManagerStudents LIMIT 200`, `getLeads`/`getAllTasks` return everything. | Doc | P2 |
| F-9 | Hard deletes with no cascade or soft delete (`deleteLead/Class/Course/Batch`). | Doc | P1 |
| F-10 | Fuzzy matching: `getTeachersList` uses `email LIKE '%teacher%'`, task lookup uses `description LIKE '%id%'`; ids from `Date.now()`/`Math.random()`. | Doc | P2 |
| F-11 | Duplicate/legacy tables (`leads`/`crm_leads`, `users`/`erp_users`) kept in sync by hand; duplicate API implementations (S9). | Doc | P2 |
| F-12 | These were only skimmed in the audit, not read line by line: PlacementDashboard, DMDashboard, ContentPlanner, TimetableManager, StudentProgress, Course/Module/Class editors, Asana task UI, ModuleMap, CareerCenter, PresentationView, CodeWorkspace, JitsiMeet, TTS backend, `scripts/*`. | Doc | P2 |
| F-13 | Bundle is one 5.3 MB chunk (1.3 MB gzipped), no route-level code splitting. LCP/INP/CLS never measured on a production build. | Doc | P2 |
| F-14 | The `RULES.md` rules ("no dummy data", "verify across all portals") were applied by hand in the audits; no automated test enforces them. In the code I grepped, the demo leads are DEV-only (`crm.ts`), so none reach production. | Checked | P2 |

## 4. Accessibility and UX leftovers (`PAGE_ASSESSMENT.md`)

| # | Item | Pri |
|---|---|---|
| A-1 | ~~No single-pointer alternative to dragging on the CRM pipeline (WCAG 2.5.7)~~ — **correction 20 Oct:** it exists. Opening a lead (click or Enter) shows a stage selector in the lead drawer (`LeadDetailPanel.tsx`, `STATUS_BUCKETS`), which does the same move with the same rules. The assessment was wrong; no change needed. (Not exercised end to end in a browser today.) | Closed | — |
| A-2 | ~~Auto-moving announcements ticker has no pause control (WCAG 2.2.2)~~ — **fixed 20 Oct** (`StudentPortal.tsx`): pause/resume button, stops under reduced-motion, duplicate text hidden from screen readers. Not looked at on screen (needs an announcement in the DB). | Fixed | done |
| A-3 | **Never measured**: modals and drawers (other than the lead drawer), hover/focus/disabled states, quiz/test attempt screens, blog posts, course detail pages, `/manager/approvals/<id>`, staff pages at 375 px, text over images/gradients, non-text contrast (1.4.11, e.g. the pale chart bars), 44 px targets. | P2 |
| A-4 | **Never tested**: real screen readers, real devices, cross-browser, live Razorpay / WhatsApp / Pyodide runs. | P2 |
| A-5 | ~~Sales pitch "Add material" inputs / "+" button (white text on a white field)~~ — **fixed 20 Oct**. Root cause found: commit `1d7ac6c` ("inject explicit dark mode utility classes", script `fix_dark_mode.py`) matched `bg-white/20` as `bg-white` and rewrote it to `bg-white dark:bg-black/20` (opaque white block in light mode). **All 35 occurrences in 11 files restored** to the original translucent classes (`bg-white/20`, `hover:bg-white/10`, `dark:bg-white/10`, …): JitsiMeet, ClassFlow, ModuleMap, ClassesPage, Leaderboard, ReferralCenter, CodeWorkspace, LiveStreamDashboard, PresentationView, TeacherCMS, SalesPitchPage. Not yet looked at on screen (only the sales pitch card was); 2 plain `hover:bg-white dark:bg-black` (no suffix) remain. Look at the teacher presentation/code views and the Jitsi controls once. The same commit also added `dark:text-white` / `dark:bg-zinc-900/50` in bulk; those were not reviewed. | P2 |
| A-6 | Public site light theme not re-measured (entrance animations stall in a hidden pane). Pre-registration, Placement dashboard (no h1) and public form `autocomplete` still rated C/B−. | P2 |
| A-7 | Visual check of the deeper brand blue (round 4 changed `primary`, `secondary`, `danger` fills in both themes) by whoever owns the design. | P3 |
| A-8 | Attendance matrix: clipped title on mobile; Students filters stack full-width on desktop; Manager attendance is a 1,926-line component. | P3 |
| A-9 | Answer-feedback colours in the class flow were calculated, not seen on screen. | P3 |

## 5. Testing and tooling

| # | Item | Status | Pri |
|---|---|---|---|
| T-1 | **No CI** (no `.github/`). Nothing stops a regression from being merged. | Checked | P1 |
| T-2 | **TypeScript: 297 errors** (mostly unused imports); **ESLint ~840 errors** (mostly `any`). | tsc checked | P2 |
| T-3 | **Playwright suite exists** (`tests/e2e`, 24 cases per `TEST_READY.md`) but has not been run in this work; its state is unknown. | Checked | P1 |
| T-4 | Unit tests: 157 / 157 pass (only with a blank `VITE_TURSO_*`; tests touch the real DB config if `.env` is present). | Checked | P2 |
| T-5 | Only two Netlify functions (`create-order`, `verify-payment`); every other server concern (login, sessions, AI proxy, scoring) does not exist yet. | Checked | — |

## 6. Public website (home and public pages) — status after round 6

Done 20 Oct (details in `PAGE_ASSESSMENT.md` §4.8): the seven navy-shell pages (course, apply, pay, blog, blog post, webinar, gallery) are legible in both themes (they were 1.0–1.3:1 on the headline), pre-registration no longer hides its breadcrumb under the header, the header menu fits at 1024–1280 px, footer links are 24 px, blog related-post images and filters fixed, 404 has a main landmark. Measured with a pixel-based checker on 9 pages, 1280 px and 375 px, light and dark.

| # | Item | Class | Pri |
|---|---|---|---|
| W-1 | `/about` 404s (the footer "About Us" link). Needs your call (D-1): build the page or remove the link. | C | P1 |
| W-2 | Pre-registration data looks like placeholders: "Access valid for 99999 days", "0 Duration", 4.5 rating from 26,521 ratings. Confirm or correct. | C | P1 |
| W-3 | Pages not measured: Enroll, Login, Certificate verify, Placement dashboard, mock-test portal (own layouts). Placement dashboard has no `h1`. | A | P2 |
| W-4 | Page `<title>` for `/apply/:course` is generic ("Apply for a Course"); per-course titles would help search and sharing. Public `<title>`s and canonicals otherwise look right (home, courses, pre-registration, webinar, gallery, blog). | A | P3 |
| W-5 | Heading order skips a level on most pages (h1 → h3). Minor for screen-reader navigation. | A | P3 |
| W-6 | Visual design and copy were **not** reviewed (legibility and layout faults only). If you want a redesign or new sections, that needs a brief from you. | C | — |
| W-7 | Performance of the public site is unmeasured on a production build (bundle is one 5.3 MB file, F-13). | A | P2 |

---

## Suggested order (we can change it)

1. **Housekeeping (§0):** *(done on my side 20 Oct: H-2..H-6; the commit groups are in `COMMIT_PLAN.md`; the only thing left is your review and the commits.)*
2. **Role access matrix** (read-only measurement) so the access gaps are known, not guessed.
3. **Decisions (§2):** a short list, each answerable in one line.
4. **Quick class-A security fixes:** S-14 (`localhost:5000`), H-4, S-15 (CSP), S-12/S-13 once decided.
5. **Server layer (B):** login/session first, then DB proxy with role checks, then payments and scoring. This is a project, not a patch; it also closes S-1..S-3, S-5, S-6, S-8..S-10 in one go.
6. **Functional bugs (§3)**, highest first: F-7, F-4, F-1, F-9.
7. **Accessibility leftovers (§4)** and tooling (§5: CI, fix the lockfile, run the Playwright suite).
