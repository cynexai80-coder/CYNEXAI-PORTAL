# Commit plan (for your review — nothing has been committed or pushed)

Repo: `C:\Users\kk\.gemini\antigravity\scratch\cynexai-website` (branch `main`, in sync with `origin/main` at `a46ca1d`).
The working tree holds **~190 changed paths** from several rounds of work. This groups them so each commit tells one story.

**Why the order matters.** Pages import the new helpers (`feedback.ts`, `a11y.ts`, `autoLabel.ts`, `LoadState`, …). Commit helpers first, pages last. Commits 5–7 are *not* independently buildable, so run the checks below after commit 7, not after each one.

**Before every commit:** `git status --short` and `git diff --cached --stat`. `.env`, `.env.*` and `backend/.env` are git-ignored (only `.env.example` is tracked). If any real token shows up in a diff, stop.

## Commits

### 1. Untrack personal data and credential dumps
Already staged as deletions. Pairs with `.gitignore`.
```bash
git add .gitignore
git commit -m "chore: untrack student data, seed json and credential-dump scripts"
```
Staged deletions: `Modules Data.xlsx`, `Student_Data.xlsx`, `students_seed.json`, `diff.txt`, `history.txt`, `get_all_creds.mjs`, `get_creds.ts`, `show_logins.mjs`, `show_student_logins.cjs`.

### 2. Move secrets out of scripts and tools into environment variables
```bash
git add scripts scratch check-db.cjs check_schema.mjs check_tables.mjs patch_sales.mjs restore_students.js test_analytics.mjs test_ceo.mjs test_login.mjs
git commit -m "chore(scripts): read database credentials from the environment, guard production schema sync"
```
Includes `scripts/sync_prod_schema.cjs`: it now only runs on a Netlify build (or with `SYNC_PROD_SCHEMA=1`).

### 3. Server side: payments, WhatsApp service, headers
```bash
git add backend netlify netlify.toml src/lib/razorpay.ts src/lib/api/payments.ts .env.example
git commit -m "fix(server): verify payments server-side, restrict backend CORS, add CSP report-only header"
```

### 4. Documentation
```bash
git add FULL_AUDIT.md SECURITY_AUDIT.md PAGE_ASSESSMENT.md OPEN_ISSUES.md COMMIT_PLAN.md SERVER_LAYER_PLAN.md ROLE_ACCESS_MATRIX.md
git commit -m "docs: audits, page assessment, open issues, server-layer plan and commit plan"
```

### 5. Data layer and business-logic fixes (with their tests)
```bash
git add src/lib schema.json src/data package.json package-lock.json
git commit -m "fix(data): audit fixes across api modules, shared utils, tests; sync lockfile, drop unused packages"
```
Also in this group since 20 Oct: timetable slot opens the class being taught (`student.ts` + test), production-URL fallback only in production builds (`turso.ts`). (The India-time "today" edits in 7 components/pages and the public-site fixes land in commits 6–7 by directory.)
Contains `turso.ts` (production URL fallback only in production builds), `auth.ts` (no backdoor logins), all `src/lib/api/*`.

### 6. Shared UI foundation: accessibility, dialogs, layout, SEO, theme
```bash
git add src/components src/index.css src/seo src/App.tsx
git commit -m "feat(a11y): skip link, landmarks, feedback dialogs, load states, route titles, theme contrast"
```

### 7. Pages
```bash
git add src/pages
git commit -m "fix(pages): contrast, labels, keyboard access, error states, no placeholder data"
```
Or split by area if you prefer smaller commits: `git add src/pages/student`, `src/pages/crm`, `src/pages/teacher`, then the rest.

## After commit 7 (run in this order)
```bash
npx tsc --noEmit -p tsconfig.app.json     # expect ~297 errors (known, mostly unused imports), none new
VITE_TURSO_AUTH_TOKEN= VITE_TURSO_DATABASE_URL= npx vitest run    # expect 157 passing
npm ci --dry-run                          # lockfile must be in sync
git status --short                        # should be clean
```
Do **not** run `npm run build` with the real `.env` present unless you mean to. Since this round the schema sync is skipped outside Netlify, so a local build is safe, but use `npx vite build` if you only want to check that the bundle compiles.

## Push
Only after you have looked at the diff. Pushing publishes the history to `origin` (GitHub). Per your note the tokens in older commits are demo values and the live ones sit in the Netlify environment, so no rotation is planned.
