# CynexAI Portal — Page-by-Page Assessment

Assessed 19 Oct 2026 against the real repo (`...\scratch\cynexai-website`), using a **local seeded database** that mirrors the production schema (`schema.json`). Production data was never touched. Nothing is committed.

Standards used: WCAG 2.1/2.2 AA, Nielsen's usability heuristics, OWASP ASVS (UI-visible parts), Core Web Vitals, and the conventions of mature LMS / CRM / task-manager / checkout products.

**Five rounds of work are recorded here:** round 1 assessed every page and fixed the functional bugs it found (§3). Round 2 implemented the accessibility quick wins (§4.1–4.4). Round 3 replaced all native dialogs (§4.5). Round 4 fixed dark-theme contrast and sub-24 px tap targets (§4.6). Round 5 fixed the student portal's light-theme text contrast (§4.7). Ratings in §1 are the state **after** round 2; rounds 3 and 4 improve the form/CRUD pages and the contrast/mobile columns further but were not re-rated. "(was X)" shows what changed.

## How this was done (and what it does not cover)

| Method | Coverage |
|---|---|
| Real login through the form for CEO, Manager, Sales, DM, Teacher, Student, Admin | 60+ routes rendered with data at 1280 px |
| Automated DOM audit per route (landmarks, headings, names/labels, keyboard reachability, contrast, tap-target size, console errors) | every route listed below, before and after round 2 |
| Real keyboard checks (Tab, Enter) in the browser | skip link, student row, module lesson |
| Mobile (375 × 812) pass | public site + 6 manager/sales routes (round 1 only) |
| Static scan of 101 page/component files | alerts, labels, loading/error states, responsive classes, SQL in UI |
| Failure simulation | local DB stopped to check the student dashboard's error state, then restarted to check Retry |
| Earlier code review of money, grading, attendance, CRM and task logic | see `FULL_AUDIT.md` |

**Measurement correction.** My first "mouse-only" counts (Reports 218, Home 212, Students 123 …) counted every descendant of a clickable region, so they were inflated. A later reading of 0 was also wrong: the new `<main tabindex="-1">` made every element look "inside a focusable ancestor". The numbers in this version count **click roots** (the outermost clickable element) and ignore `tabindex="-1"`.

**Not covered:** real screen-reader testing, real devices, cross-browser, Core Web Vitals on a production build (the dev server is not representative), live Razorpay/WhatsApp/Pyodide runs, mobile re-test after round 2, anything that needs the production database.

**Rating scale:** **A** production-ready · **B** works, polish needed · **C** works but has gaps a user will hit · **D** broken or misleading in a common path.

---

## 1. Scorecard (after rounds 1 + 2)

| Area | Page | Function | States | Accessibility | Mobile | Verdict |
|---|---|---|---|---|---|---|
| Public | Home `/` | A | B | B− (contrast left) | B | **B** (was B−) |
| Public | Course `/course/:id` | A | B | B | B | **B+** (was B) |
| Public | Apply `/apply/:id` | B | B | B− (heading contrast) | B | **B−** (was C+) |
| Public | Pre-registration | B | B | C (22/75 contrast fails) | B | **C+** (was C) |
| Public | Enroll `/enroll` | B | B | B | B | **B** (was C+) |
| Public | Pay `/pay` | B | C | B | B | **B−** (was C+) |
| Public | Blog / Gallery / Webinar | B | B | B− | B | **B** (was B−) |
| Public | Certificate verify | B | B | B | B | **B** |
| Public | Placement dashboard | B | C | C | B | **C** |
| Public | Footer newsletter (every page) | **was D** (button did nothing) → B | B | B | B | **B** |
| Public | 404 | A | — | A | A | **A−** |
| Staff | Login | A | A | A− | B | **A−** |
| Manager | Hub | B | B | B+ | B | **B+** (was B) |
| Manager | Course CMS / editors | B | B | B | — | **B** |
| Manager | Staff management | B | B | B | — | **B** (was B−) |
| Manager | Gamification | B | B | B | — | **B** (was C+) |
| Manager | Timetable | B | B | B (empty cells stay a mouse shortcut) | — | **B** (was B−) |
| Manager | Students directory | B+ | B | B+ | B | **B+** (was B) |
| Manager | Attendance matrix | B | C | C | **C** | **B−** |
| Manager | Student progress | B | B | B | B | **B** (was B−) |
| Manager | Approval detail / Assign batch | B (was **D**: checklist bypass, dead back link) | B (was **D**: infinite loader) | B | — | **B−** (was C) |
| CEO | Dashboard | B | B | B | — | **B−** (fake AI card) |
| CEO | Reports | B | B | B | — | **B−** (was C+) |
| CEO | Settings / AI voice | B | B | B | — | **B** (was B−) |
| Sales | Dashboard | B | B | B− | — | **B** |
| Sales | Pipeline | A− | B | B+ | B | **A−** (was B+) |
| Sales | Lead new / detail | B+ | B | B | — | **B+** (was B) |
| Sales | History / audit | B | B | C | — | **C+** (visible to Sales) |
| DM | Dashboard / Planner | B | B | B | — | **B** |
| Teacher | Hub / Timetable / CMS | B (was: dead-end tile) | B | B | — | **B+** (was B) |
| Teacher | Live stream | B− | B | B− | — | **B−** (was C+) |
| Teacher | Presentation view | B | B (was **D**) | B | — | **B** (was C) |
| Teacher | Attendance system | B | B | C | C | **B−** |
| Student | Dashboard | B+ (was **D**: wrong course lookup, fake chart, 0% attendance) | **B+** (outage now shows Retry) | B | B | **B+** (was B) |
| Student | Classes / Module map | B | B | B | — | **B** (was B−) |
| Student | Sign out | B (was **D**: did not end the session) | — | B | B | **B** |
| Student | Class flow | B | A− | B | — | **B** |
| Student | Assessment / Quizzes | B− | B | B− | — | **B−** |
| Student | Attendance check-in | B | B | B− | — | **B** |
| Student | AI Interview | B− | B | B | — | **B−** |
| Student | Career center | B− | B | B | — | **B−** |
| Admin | `/admin` blog management | B | B | C | — | **B−** |

No page scrolls horizontally at 375 px (round 1), and none crashed in either round. Contrast and Mobile cells above predate round 4 (§4.6), which removed the dark-theme contrast failures and sub-24 px targets they cite.

---

## 2. What is still wrong (cross-cutting)

1. ~~**Blocking dialogs**~~ — **done in round 3 (§4.5):** all 94 `alert()`, 28 `confirm()` and 8 `prompt()` calls now use a shared toast / confirm / prompt component.
2. ~~**Contrast (dark theme).**~~ — **done in round 4 (§4.6):** every audited route now has 0 text-contrast failures in the dark theme (was e.g. Pre-registration 22/75, Pipeline 13/161, Reports 11/90, Attendance 10/91). The student portal's light theme was fixed in round 5 (§4.7); the staff light theme followed (§4.7, "Staff light theme"): 0 failures in both themes on every parameter-free staff route.
3. ~~**Tap targets under 24 px**~~ — **done in round 4 (§4.6):** 0 controls under 24 × 24 px on the audited desktop and 375 px routes (was 16–29 per public page, 90 on the mobile attendance matrix, 22–24 on History). 44 px targets were not attempted.
4. ~~**Single-pointer alternative to dragging** on the CRM pipeline (WCAG 2.5.7).~~ Not a gap: the lead drawer (open a card with click or Enter) has a stage selector that does the same move with the same rules.
5. ~~**Auto-moving announcements ticker** on the student dashboard needs a pause control (WCAG 2.2.2).~~ Fixed in round 6 (§4.8).
6. **Data layer:** the runtime `CREATE TABLE` statements still disagree with `schema.json` in other places; round 1 patched the columns the pages actually query. One migration module plus a CI test that runs the pages against a fresh DB would stop this recurring.
7. **DB failures fail open.** `turso.ts` has a circuit breaker that, once tripped, answers *every* query with an empty result. Any page that doesn't check `isDbFailed()` shows an empty state during an outage. Only the student dashboard checks it now.
8. **Performance:** single 5.3 MB JS chunk (1.3 MB gzipped), no route-level code splitting in the portal. Not measured: LCP/INP/CLS on a production build.
9. **Security as seen from the UI** (needs a server layer, `FULL_AUDIT.md` class B): answer keys shipped to students, grading/coins/attendance decided in the browser, DB token in the bundle, SQL run from 6 components, and the Profile page asks staff to paste Groq/OpenAI keys into the browser.

### Product decisions needed (not code)
- **`/about` goes to the 404 page.** The Header and Footer both link "About Us" but the About page was deleted from this repo in an earlier commit. Either restore a page or remove the two links.
- **Sales reps can open the company-wide audit log** (`/sales/history`) and Course Management. Restrict, or confirm that is intended.
- **Sales pitch "What We Send" template is saved to each browser's `localStorage`**, so a manager's edits never reach the sales team. It needs a database table.
- **Teachers don't get the Student Progress module by default.** The hub tile is now hidden; decide whether Teachers should see it.
- **CEO dashboard "AI Strategic Advisory"** is static text with only the conversion percentage live. Compute a real insight or drop the "AI" label.

---

## 3. Round 1 — bugs found while assessing, and fixed

| # | Problem | Fix |
|---|---|---|
| 1 | **Student dashboard showed "No Course Enrolled"** for any student not linked through sales → onboarding. The fallback looked up `courses.name`, a column production does not have, so the query always threw and was swallowed. | `student.ts`: look up by `LOWER(TRIM(title))`. Verified. |
| 2 | **Attendance rate showed 0%** for a student who had attended: the query matched the login id only, but teacher-recorded logs use the `students.id`. | Match both ids. Verified 0% → 10%. |
| 3 | **"Weekly Learning Performance" was a hard-coded decorative curve** with a fake "This Week" dropdown. | Real classes-attended-per-weekday (IST week), empty state, accessible label. Verified. |
| 4 | Fresh-DB `no such column` / missing table failures on six pages. | Idempotent migrations in the staff-only bootstrap (`turso.ts`) for `courses.price`, `modules.instructor_id`, `classes.description/ai_summary`, `sales.sales_rep_id`, and `manager_student_progress`. Verified. |
| 5 | Stale titles/canonicals, indexable 404 and indexable private routes. | `RouteMeta.tsx` resets metadata for unlisted routes, self-canonical, `noindex` for portal/transaction/certificate routes; 404 sets its own title + `noindex`. Verified. |
| 6 | Teacher hub **"Student Progress" tile dead-ended on "Access Restricted"**. | Tile shown only when the teacher has the module. |

## 4. Round 2 — accessibility quick wins, and the extra bugs they uncovered

### 4.1 What was implemented

| Item | What changed | Verified |
|---|---|---|
| **Landmarks + skip link** | `<main id="main-content">` in the staff layout, student layout, public layout, Login, Enroll and the "Access Restricted" view; `<aside>`/`<nav aria-label>` on the sidebar, mobile bar and student nav; a "Skip to main content" link (`SkipLink.tsx`); collapsed sidebar and closed mobile drawer are `inert` so they leave the tab order. | Real Tab → skip link shown → Enter → focus lands on `<main>`, URL unchanged. Landmarks present on every audited route. |
| **Per-route titles** | `seo/portalTitles.ts` (≈70 routes) used by `RouteMeta`; blog posts use the post title; missing article sets title + `noindex`. | 5 unit tests; titles seen on 25+ routes ("Manager Hub \| CynexAI"). |
| **Keyboard-operable cards and rows** | `Card` with an `onClick` is now `role="button"`, focusable, Enter/Space. New `lib/a11y.ts` (`keyboardActivate`) applied to the student directory tiles and rows, reports rows, staff batch rows, task rows, timetable class blocks, module-map lesson nodes, mobile lead cards, pipeline cards (Enter opens the lead). `DataTable` headers are real buttons with `aria-sort`; expandable rows and editable cells work from the keyboard. "Add Module" and the Projects toggle are real buttons. | Click-root counts, before → after: Students **10 → 0**, Reports **8 → 0**, Staff **30 → 0**, Module map **5 → 0**, Course Mgmt "Add Module" fixed. Enter on a student row selects it; Enter on a lesson opens the class. |
| **Labels and names** | `lib/autoLabel.ts` links `<label>`→control and names `<span>Batch:</span><select>` / placeholder-only fields app-wide (and for modals that mount later); 9 unit tests. Explicit `aria-label`s on the filters, searches, selects and toggles (`role="switch"`) of Gamification, Portal Settings, Reports, Student Progress, Attendance, Tasks, Timetable, Sales Pitch, Pipeline, Students, Staff, Footer, Login. Icon-only buttons named: pipeline call/WhatsApp/clear/hide, task actions, week navigation, back buttons, footer social links, back-to-top. | Unnamed controls and unlabeled inputs are **0** on every audited Manager / CEO / Teacher / Student / public-form page, e.g. Gamification 17 → 0, Pipeline 49 → 0, Apply 5 → 0, Enroll 8 → 0. |
| **Error / not-found states instead of loaders** | New `LoadState.tsx`. Approval detail and Assign batch show "not found / try again"; Presentation view without a class explains itself; the student dashboard shows its "Failed to load → Retry" card when the DB is unreachable (and Retry resets the circuit breaker); the auth spinner is announced; "Access Restricted" now has a "Back to my dashboard" button. | Stopped the local DB: student sees **Failed to load**, not "No Course Enrolled"; restarted it and Retry loaded the dashboard. |

### 4.2 Real bugs these changes uncovered (all fixed)

| # | Bug | Impact |
|---|---|---|
| 1 | **Student "Sign Out" removed the wrong storage key** (`cynexai_user`, the app uses `erp_session_token`). | A student could not actually sign out; the next visitor on a shared computer stayed signed in. Now calls `logout()`; verified the session is cleared. |
| 2 | **Approval checklist could be bypassed.** The saved checklist replaced the six-item default; when none was saved (`{}`), `Object.values({}).every(...)` is `true`. | A Manager could approve a sale without ticking anything. Missing items now default to unchecked. |
| 3 | Approval "back" arrow went to `/crm/manager`, which no longer exists. | Landed on the 404 page. Now `/manager`. |
| 4 | **Footer "Subscribe" button did nothing** — no form, no handler — on every public page. | Visitors believed they had subscribed. Now stores a lead (`Newsletter`), validates the address, shows success/error. Verified end to end. |
| 5 | A dead "⋮" button on every task row (no handler). | Removed. |
| 6 | `cursor: pointer` on course cards and gallery photos that are not clickable. | Removed the misleading cursor. |

### 4.3 Verification
144/144 tests pass (27 files, +15 new). `tsc` errors identical to the baseline set (299, all pre-existing unused-import / `any`); the new files are ESLint-clean. Browser checks above. Nothing committed.

### 4.4 Deliberately left as is
- **Timetable empty cells** (91) stay a mouse shortcut for "schedule a class here"; the keyboard path is the "Schedule Class" button, and the class blocks themselves are now keyboard-operable.
- **Course Management header rows** and **Classes page module cards** have a click handler on the container *and* a real button inside that does the same thing, so keyboard users are covered.
- **Contrast, tap targets** — see §2.

### 4.5 Round 3 — native dialogs replaced

Every `alert()`, `confirm()` and `prompt()` in the app (130 call sites in 38 files) now goes through one small API, `lib/feedback.ts`, rendered by `components/ui/FeedbackHost.tsx` (mounted once in `App`):

| Before | Now |
|---|---|
| `alert(msg)` (94) | `notify(msg)` — a non-blocking toast; success / warning / error / info is inferred from the wording, with `notify.success/.error/.warning/.info` where wording would mislead (e.g. the CSV-import summary, "all test cases passed" vs "submitted but not all passed"). Errors are announced as alerts, others politely; toasts pause while hovered or focused; Dismiss button; duplicates collapse; max 4 stacked. |
| `confirm(msg)` (28) | `await confirmDialog({ title, message, confirmLabel, danger })` — a labelled `alertdialog`. Destructive actions are red and **default focus to Cancel**; Escape / backdrop = cancel; Tab stays inside the dialog; focus returns to the button that opened it. |
| `prompt(msg)` (8) | `await promptDialog({ ..., inputType, validate })` — a labelled dialog with an inline validation message instead of accepting anything. New checks: phone numbers need 10 digits, file names can't be blank or duplicates, "classes in module" must be ≥ 1, partial-payment amounts must be positive. |

If the host is ever not mounted, `notify` only logs (never a native alert) and `confirmDialog` falls back to the browser's confirm.

**Verification:** 13 new unit tests for the component and API (157/157 pass in total); `tsc` is at 298 errors — one fewer than the baseline, none new; no `alert(`/`confirm(`/`prompt(` calls remain in `src`. In the browser: a validation toast appears with no native dialog; the Reject-student confirm opens with Cancel focused, Escape closes it, the record stays, and focus returns to **Reject**; the batch editor's "Add subject" opens a prompt, accepts a name with Enter, chains the "Classes in module" prompt, and adds the subject; the dialog is usable at 375 px.

**Not exercised live:** the Confirm (destructive) path of each dialog (only unit-tested, to avoid deleting local test data), and the ~85 toast call sites other than the one shown above.

### 4.6 Round 4 — dark-theme contrast and tap targets

**Root causes (two, not hundreds):**

1. `index.css` forces `.text-slate-900/800/700` to the theme's light text colour in the dark theme (and `.text-slate-600/500` to the muted colour), but pale surfaces (`bg-*-50/100`, `bg-*-500/10…25` tints, `bg-slate-50/100`) were left pale. Result: light text on a light fill, 1.1–2.5:1. Most of the old counts came from this.
2. White text on the brand fills was under 4.5:1 in *both* themes: `bg-erp-primary` #3B82F6 = 3.7, `bg-erp-secondary`/`bg-erp-info` #0EA5E9 = 2.8, `bg-erp-danger` #FF4B4B = 3.3.

**What changed**

| Area | Change |
|---|---|
| Brand fills (`index.css`) | `primary` → #2563EB (5.2:1), `secondary`/`info` → #0369A1 (6.0:1), `danger` → #DC2626 (4.8:1). **Visible design change:** brand buttons are slightly deeper in both themes. |
| Pale tints and pills | Text on pale tinted fills moved one step darker (`text-*-600` → `-700`, amber/yellow → `-800`, `text-slate-500` → `-600`); pale pre-registration, attendance and success/danger surfaces got dark counterparts. |
| Computed colours | Pipeline stage chips (`LeadPipeline.tsx`) and the student status badge (`Students.tsx`) derive text from the stage colour with `color-mix`, so any stage colour stays legible. |
| Last-pass finds | `AttendanceButton` ("Log Out of Office" was white on pale red in dark mode) and the attendance "Export CSV (All Classes)" button (green text on a solid blue fill → ghost variant). |
| Tap targets | Every control is now at least 24 × 24 CSS px (WCAG 2.5.8): Reviews carousel dots (24 px hit area around a 12 px dot), timetable "TODAY", back links, small icon buttons, "Show password" on Login and the placement gate, the payment page's close button. `html` is 14 px below 768 px so rem sizes shrink on phones; fixes use explicit `min-w-[24px] min-h-[24px]`. |
| Dead control removed | The payment page had a "Coupon Code → Apply" row with no handler. Removed rather than styled. |

**Verification (browser, full reload before each scan, local test DB only)**

| Check | Before | After |
|---|---|---|
| Dark theme, text contrast, 1024 px — Student (10 routes), Manager + Sales (21), CEO (19), DM planner, Teacher + Admin (10), public (/, gallery, webinar, pre-registration ×2, pay, blog, enroll, login, placement dashboard) | tens to hundreds of failures per page | **0** on every route |
| Tap targets under 24 px, 1024 px — Student routes, `/`, gallery, webinar, pre-registration | — | **0** |
| 375 px, dark — staff (CEO/Sales, 13 routes), Student (10), public (/, gallery, pay, blog, enroll, login, placement): contrast and targets; webinar, pre-registration, `/test`: targets only | e.g. 90 on the attendance matrix | **0 / 0** |

The final mobile pass still found three (payment close 21 px, two "Show password" 21 px); fixed and re-measured at 0. The final dark pass found two more failing buttons (above), fixed and re-scanned clean.
Unit tests: 157 / 157. `tsc`: 298 errors, none new against the baseline set (299). Nothing committed.

**Not fixed — please decide**
- ~~**Student portal, light theme.**~~ Fixed in round 5 (§4.7).
- **Not measured:** modals and drawers, hover/focus/disabled states, the quiz/test attempt screens, blog posts, course detail pages, the 404 page; text over images or gradients (the checker skips them); non-text contrast (1.4.11) apart from the two icon buttons touched above; 44 px targets.
- A reading of the Quizzes hero in the light theme looked failing, but it was a CSS transition frozen mid-way in a hidden browser pane; the settled colour is the intended dark fill. Treat any scan in a hidden pane with that in mind.

### 4.7 Round 5 — student portal, light theme

**Cause.** Secondary text on the student pages was written for dark surfaces (`text-slate-400`, `text-*-400`) and never got a light-theme variant, so on white and pale cards it measured 1.6–3.0:1. The fix is `text-slate-600 dark:text-slate-400` (and `-700`/`-800` shades for coloured pills). Dark-theme output is unchanged: `index.css` already forces `text-slate-600` to the same muted colour (#94A3B8) in the dark theme, and every coloured change keeps its old shade behind `dark:`.

| Where | Change |
|---|---|
| Sidebar | "Navigation" label and the signed-in email |
| Dashboard | In Progress / Completed / Upcoming captions, weekday labels, "No classes attended yet", "Student Portal" eyebrow |
| Quizzes | "Module Filter" label, quiz descriptions, locked-card caption, loading caption; the hero's three stat captions were `slate-500` on the dark hero (3.3:1 on phones) and are now `slate-400` |
| Classes | "Progress" caption, loading caption |
| Module map | Lesson / Video / Live / Q&A / Coding labels now use a darker shade in the light theme (two CSS variables per kind, same dark-theme colours as before); "Next up" and "Locked" pills |
| Mock interview | Weekly-quota pill (green / amber) and "Twice per week limit" |
| Class flow | Recorded / Watched / Attendance / Completed chips, "Marked!", selected / correct / wrong answer buttons (were pale `-400` on a pale tint, nearly invisible after submitting), "coins earned", the "waiting for teacher" button |
| Python editor (always dark) | "Initializing Python…", terminal placeholder and a loading label now read on the dark surface; the "clear output" icon button got a name and a 24 px target |
| Assessment studio | Loading caption |

**A regression of my own, fixed.** In round 4 a colour pass gave the Python editor's "Initializing Python…" badge `amber-800`, which is wrong on that always-dark toolbar (2.2:1 in the light theme). It is back to `amber-400`.

**Verification** (full reload, CSS transitions disabled so a hidden pane cannot freeze them): the 14 student views — dashboard, classes, quizzes, attendance, career, interview, module map, assessment (MCQ and Python tabs), class flow (video, Q&A, coding) — measure **0 text-contrast failures in the light theme at 1280 px and 375 px, and 0 in the dark theme at both**; 0 targets under 24 px at 375 px. Unit tests 157 / 157; `tsc` 298 errors, none new. Nothing committed.

**Not covered / not fixed**
- Answer-feedback colours (correct / wrong / selected) were changed but not seen on screen: submitting advanced to the next question before a scan could run. Contrast of the new pairs was calculated, not measured.
- `Leaderboard.tsx` and `ReferralCenter.tsx` still carry dark-only colours; their routes redirect to the dashboard, so they are unreachable.
- ~~**Staff light theme has residuals**~~ — fixed, see "Staff light theme" below.
- The public site's light theme was not re-measured: its entrance animations stall in a hidden browser pane and give false readings.

**Staff light theme (follow-up to the sweep above).** Same recipe: `text-X-700 dark:text-X-400` (amber `-800`), with the dark class set to the colour the element already had, so the dark theme is unchanged (checked: History badges/counters and the chart legend read the same RGB values in dark as before).

| Where | Change |
|---|---|
| Audit History (`/ceo/history`, `/sales/history`) | Type badges (sale / activity / stage / approval / task), "Associated Contact:" label, the three summary counters, the Copy hover colour. The stage-change chip and timeline icons sit on permanent `slate-900/950` and were left alone |
| CEO Reports | Overdue / Missed / Conversions / In-progress counters and the red overdue dates (also inside the expanded row) |
| Sales dashboard | Chart legend: Recharts paints legend text in the series fill (`#b8ff22`, `#e5e7eb`); a `formatter` now renders the text in `zinc-700` in light and the series colour in dark. The bar fills are unchanged |
| Sales pitch | "No materials assigned yet." was white on white (an earlier find-and-replace had turned `bg-white/10` into `bg-white`); the box is now `bg-black/20` over the blue card. The two *Add material* inputs on the same card have the identical defect (white text on a white field) and were **not** touched — see below |
| Lead form | Required asterisk; the red error lines in the Sale and Admission forms |
| Timetable | "Today" label |
| Task chips | "Medium" priority (`blue-600` on `blue-100`, 4.2:1, **also failing in dark** because `bg-blue-100` stays pale there) is now `blue-700` in both themes (AsanaTaskApp, TaskListView, TaskDetailPanel). The "0 leads" chip on the Marketing hub is `blue-700` |
| Found while measuring | `text-erp-secondary` (#0284C7 = 4.1:1 on white) on the lead's course chip (`LeadDetail`, `LeadDetailPanel`), the manager approvals amount chip, the admission note, payment-progress %, approval detail and the admin Leads card → `sky-700` in light; "Email: / Grad: …" labels and "Added By" and the Delete button in the lead drawer; the Teacher hub's "No upcoming classes" line; the Approval-detail "fully paid" green (`green-500` → `green-700`) |

**Verification** (local test DB only, full reload per role, transitions disabled, 1280 px): **0 text-contrast failures in the light theme and 0 in the dark theme** on every `/ceo/*` (20 routes, Reports with every row expanded, pipeline with a lead drawer open), `/sales/*` (7, incl. `/sales/leads/<id>`; `/sales/courses` light only), `/teacher/*` (10), `/manager/*` (11) and `/dm/*` (4) route that has no URL parameter. A planted `#b8ff22`-on-white probe was caught by the same checker, so a 0 is not a blind spot. Unit tests 157 / 157; `tsc` 297 errors (baseline 298), none in the touched lines. Nothing committed.

**Not covered**
- The "0 chip at 4.2:1 on `/ceo/dm-dashboard` and `/ceo/sales-pipeline`" could not be matched to a single node: on the seeded data the pipeline page has no text chip with that pair (only two icon-only buttons, `blue-600` on `blue-100`, which are not text). The blue chips that do measure 4.2:1 (Medium priority, "0 leads") are fixed.
- ~~*Add material* inputs on the Sales pitch card~~ — fixed in round 6 (§4.8), together with the same damage in 10 other files.
- States not measured: modals other than the lead drawer (Sale / Admission forms were fixed by class, not seen), hover/focus/disabled, `/manager/approvals/<id>`, `/ceo/courses/<…>` detail pages, the icon-only `-400` glyphs on the History KPI tiles and export button (non-text, 1.4.11), 375 px for staff pages.
- Bar fills on the Sales dashboard chart (`#e5e7eb` on white, 1.2:1) are a 1.4.11 issue; the legend text is fixed, the bars are not.

### 4.8 Round 6 — public website (home, course, apply, pay, pre-registration, blog, webinar, gallery)

**Correction to rounds 4–5.** Those rounds reported "0 contrast failures in the dark theme" for the public pages. That was wrong for any text over a photo, gradient or translucent panel: the checker skips those. A pixel-based check (below) shows the **course pages were nearly unreadable in both themes** — the headline was 1.0–1.2:1 (white on pale in light; dark slate on dark in dark) — and apply / pay / blog / webinar had light text on grey glass.

**Cause.** Seven pages were written for a dark navy shell with the original palette (`text-secondary` = light text, `bg-secondary/5` = faint white tint, `bg-background/NN` = black glass). Those tokens later became theme-dependent (`--background` is white in light, `--secondary` is dark slate in dark), so the same classes flipped.

| Where | Change |
|---|---|
| Course, Apply, Pay, Blog, Blog post, Webinar, Gallery | New `.navy-surface` class (`index.css`) pins `--background / --secondary / --foreground / --muted-foreground` to the original dark-navy values for the page content only; `MainLayout navy` in `App.tsx` applies it. The page now looks the same in the light and dark app themes; header and footer still follow the theme |
| Course | Numbered badges: light text on cyan → black |
| Apply | Form labels and the outlined button were near-black (`#010203`) on dark glass → light |
| Pre-registration | The breadcrumb sat **under the fixed header** (page started at 24 px) → `pt-28`; on phones the blue pass card clipped its bottom row (Pass ID, "Verified Admission") → grows instead of a fixed 16:9; page background opaque in light (it was a muddy grey from `bg-slate-50/70` over navy); breadcrumb `slate-600`; the blue pass card and "Buy Now" buttons use `-700` gradient stops (white text was 3.5–4.3:1); card badges `bg-black/20` |
| Home | Level badges on course cards, review roles, "Skills" subheading: `cyan-600` → `cyan-700/800` (light only); `--muted-foreground` in the light theme `slate-500` → `slate-600` (4.1–4.4:1 on tinted cards); footer link rows get a 24 px minimum height |
| Header | At 1024–1280 px the desktop menu ran off the screen ("Blog" and "Placements" cut off) and the logo touched "Home": tighter spacing (`px-4 xl:px-5`, `space-x-2 xl:space-x-4`); active item `cyan-900` in light |
| Blog | Search and category filter named; the "related posts" images no longer render `src=""` (two broken images and a console warning) |
| 404 page | Now has a `<main>` landmark |
| Certificate page | Footer links 24 px high |

**Same bug, found on the way: commit `1d7ac6c`.** The script `fix_dark_mode.py` ("inject explicit dark mode utility classes") matched `bg-white/20` as `bg-white` and rewrote it as `bg-white dark:bg-black/20`: an opaque white block in light mode, black glass in dark. 35 occurrences in 11 files (Jitsi controls, class flow, module map, classes, leaderboard, referral centre, code workspace, live-stream, presentation view, teacher CMS, sales pitch) were restored to the original translucent classes. Seen on screen: sales pitch card, module map. The other nine are **not looked at** (see `OPEN_ISSUES.md` A-5).

**Also this round (not public site):** timetable slot opens the class being taught, not class 1 (F-1); 20 "today" lookups use India time (F-4); announcements ticker has a pause button and stops under reduced-motion (WCAG 2.2.2); `npm ci` works again; the build no longer touches the live database outside Netlify; WhatsApp URL from `VITE_WHATSAPP_API_URL`; CSP in report-only mode; 8 unused packages removed (three, @react-three/*, spectacle, motion, gsap, @gsap/react, lottie-player; none imported anywhere in tracked code; 286 fewer installed packages).

**Verification.** New checker `pix.cjs` (kept in the session scratch folder, not in the repo): for every visible text it renders the page with all text transparent, screenshots the viewport and compares the text colour with the real pixels behind it (10th-percentile worst case), scrolling viewport by viewport so entrance animations have finished, and ignoring text covered by the fixed header or disabled. Local test DB only, headless Chromium.

| Check | Before | After |
|---|---|---|
| Public pages, text contrast, 1280 px, light + dark (home, course, apply, pre-registration, webinar, gallery, pay, blog, blog post) | first pixel pass: 8 / 49 / 4 / 10 / 4 / 1 / 2 / 1 / 0 failing text nodes in light; 27 on the course page in dark | **0** on all 9 pages in both themes |
| Public pages, text contrast, 375 px, light + dark | first pass: 4 (pass card clipped on phones: its bottom row was cut off by `aspect-video`; fixed) | **0**, except two readings where a line sits half under the 64 px fixed header at one scroll position (webinar FAQ heading, pay "Full Name" label); both pass where fully in view |
| Footer link heights (24 px) | 12 controls under 24 px on every page | 0 (the skip link is 1 px until focused, by design) |
| `npx vite build` (blank DB env, scratch output) | — | compiles, 5.3 MB JS (unchanged, see F-13) |

**Not fixed / not covered**
- Pages not in the 9 measured: Enroll, Login, Certificate verify (own dark layouts, light-theme texts under the fixed `slate-950` background were not an issue), Placement dashboard, mock-test portal, blog category pages.
- Content, copy and visual design were not reviewed, only legibility and layout faults. The Home page's overall look is fine in both themes; no redesign was done.
- `/about` still 404s (decision D-1). Home/Courses breadcrumb on the certificate footer both link to `/`.
- Pre-registration shows "Access valid for 99999 days", "0 Duration" and a 4.5 rating with 26,521 reviews — placeholder-looking figures in the page data; confirm they are intended.

---

## 5. Page-by-page notes (current state)

### Public site
- **Home** — Renders fully, one h1, landmarks present. Course cards are not interactive except their "Learn More" link (now shows a normal cursor). Contrast and small targets fixed in round 4.
- **Apply** — Labels are now associated, `autocomplete` should still be added, heading contrast remains.
- **Pre-registration / Enroll / Pay** — Payment is priced server-side and verified. Enroll and Pay have landmarks, h1 and labelled fields; pre-registration's 22/75 contrast failures are fixed (round 4).
- **Blog / Gallery / Webinar / Placement** — Functional. Placement dashboard has no h1 and still carries the hard-coded gate (decision C13).
- **Certificate verify** — Good behaviour (valid / revoked / not found).
- **Footer** — Newsletter works; social links named.

### Manager
- **Hub** — Real numbers (approved revenue only); tiles are keyboard operable.
- **Staff management** — Role rules enforced; filters labelled; 9 `alert()` calls remain.
- **Gamification** — Toggles are proper switches, inputs labelled.
- **Timetable** — Teacher-conflict check; class blocks keyboard-operable; week arrows named.
- **Students** — Filter tiles and rows keyboard-operable; filters labelled. Filters still stack full-width on desktop.
- **Attendance** — Largest component (1,926 lines); labels, contrast and tap targets fixed; the clipped title on mobile is not.
- **Student progress** — Table created by the bootstrap; `prompt()` for score entry remains.
- **Approval detail / Assign batch** — Not-found states, checklist fixed.

### CEO
- **Dashboard** — "AI Strategic Advisory" is static text (decision above); "Payroll / Staff" doesn't say monthly.
- **Reports** — Rows expand from the keyboard; filters labelled.
- **AI voice / Settings** — Labelled. Key handling is in `FULL_AUDIT.md`.

### Sales / HR
- **Pipeline** — Strongest page. Cards open with Enter, call/WhatsApp buttons named and shown on focus.
- **Lead capture** — Validates phone and warns on duplicates; still uses `alert()` for errors.
- **History / audit** and **Course Management** — reachable by Sales (decision above).

### DM
- Dashboard and planner render with real data; jobs use the shared `job_listings` table.

### Teacher
- **Hub** — Tile fixed. **Live stream** — has an h1 (screen-reader only), toggle named. **Presentation view** — explains a missing class. **Timetable / CMS** — controls named.

### Student
- **Dashboard** — Fixed (round 1) + failure state (round 2).
- **Module map / Classes** — Lessons keyboard-operable, back buttons named.
- **Class flow** — Correct live/recorded/waiting states. "Mark as completed" still has no watch requirement (decision L7).
- **Assessment** — MCQ section counts the coding question ("MCQs (3)" vs "4 Questions"). Answer keys visible in network responses (class B).
- **Sign out** — Fixed.

---

## 6. Recommended next steps

1. ~~Replace `alert/confirm/prompt`~~ — done (§4.5). A good follow-up is to move the pages that already roll their own notices (`ClassEditor.showAlert`, `ui/erp/ConfirmModal`, the inline banners in `AdminPanel`/`StaffAttendanceModal`) onto the same component.
2. ~~Dark-theme contrast and 24 px targets~~ — done (§4.6). Student-portal light theme is done too (§4.7). The staff light theme is done as well (§4.7). Next: a visual check of the deeper brand blue and of the Sales pitch "Add material" inputs by whoever owns the design.
3. Resolve the **product decisions** in §2 (About link, Sales access, pitch template storage, CEO advisory card).
4. Make every page that reads the DB check `isDbFailed()` (or change the breaker to throw) so an outage never looks like "no data".
5. One migration module + a CI test that boots the pages against a fresh database.
6. Route-level code splitting for the portal (target < 1.5 MB initial JS).
7. **Server layer** (see `FULL_AUDIT.md`, class B): server-side login/session, authenticated DB proxy with role policy, server-side grading/coins/attendance, remove the DB token from the browser.
