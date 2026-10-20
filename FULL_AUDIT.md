# CynexAI Portal — Full Audit (security + app logic)

Scope reviewed line-by-line: every file in `src/lib/api/*`, `src/lib/{auth,turso,cache,queryCache,gamification,razorpay,crypto}.ts`, `backend/server.js`, `netlify/functions/*`, `App.tsx`/`RequireAuth`, and the flow pages: ClassFlow, QuizzesPage, AssessmentStudio, AttendancePage, LiveStreamDashboard, AttendanceSystem (core logic), Students, UserManagement (role/password parts), LeadPipeline, LeadCapture, Sale/Admission forms, ChatPortal, Login, Profile, Enroll/PreRegistration/Payment, Certificate pages, Leaderboard/CEO dashboard, test portal, teacher workspaces, Blog.
Pages only skimmed: PlacementDashboard, DMDashboard, TimetableManager, StudentProgress, CourseManagement/Editors, Asana task UI, ModuleMap, CareerCenter, PresentationView (listed in "not fully reviewed").

Fix class: **A** = safe code change that keeps UI/flow · **B** = needs the server-side layer (login + DB behind functions) · **C** = needs a product decision from you.

---
## STATUS AFTER THE FIX PASS (nothing is committed)

**FIXED in the working tree** (tsc errors 346 -> 299, unit tests 129/129 passing, bundle builds):
R1, C4, C5 (+ hardcoded app-secret key removed from scripts), C7, C8, C10, C12, C14 (real expiring attendance codes; online attendance depends on real elapsed time), C15, C16, C17,
L1, L2, L3, L4, L5 (once-per-question coins, bounded interview coins, atomic spend, field allowlist), L6 (real streak, IST day), L7 (still instant — see below), L9 (no fabricated questions/counts, real grading), L10, L12,
T1, T2, T3, T4, T5, T6, T7, T8, T9, T10,
S1, S2, S3, S4, S5, S6, S7, S8 (+ backend), S9 (partly),
U1, U2, U3, U5, U6, U7, P1, P2, P3, P4 (no fake "saved"), P5, P6.
Also found + fixed while verifying: calendar view crashed (memo returned undefined), `Button variant="outline"` rendered unstyled, SalesDashboard pie label crash risk, stale tests.

**STILL OPEN — need the server layer (class B)**: C1, C2, C3, C6 (DB token / auth / authz / password storage), C9 (answer keys reach students; grading & coins are still decided on the student's device), C11, H8 (student code runs with eval), H10, H11 (public forms write straight to the DB), referral/coin trust, all hard-delete flows without a role check.
**NEEDS YOUR DECISION (class C)**: C13 (live-class room is a public Jitsi room named after the class id), L7 ("Mark as completed" has no watch requirement — product choice), password visibility for admins, Aadhaar/doc storage, PlacementDashboard hardcoded gate, default password cynex123 for single-student create.
**Known leftovers**: ~299 type errors (mostly unused imports) and ~840 ESLint errors (mostly `any`); package-lock.json is out of sync with package.json (npm ci fails; `npm install` works); the JS bundle is 5.3 MB (1.3 MB gzipped) — no code splitting; `ChatPortal` WhatsApp still calls http://localhost:5000.

---
## 0. Regression I introduced (fix immediately)
| # | Issue | Fix |
|---|-------|-----|
| R1 | I ran `git rm --cached students_seed.json` earlier, but `Students.tsx` and `StudentProgress.tsx` **import** that file. A clean Netlify build (git checkout) will FAIL with "cannot resolve students_seed.json". | A: remove both imports and the fake-data fallback they feed (see L4). |

---
## 1. Critical (fix before real users depend on it)
| # | Area | Finding | Class |
|---|------|---------|-------|
| C1 | Architecture | Turso DB token is bundled into the browser (`VITE_TURSO_AUTH_TOKEN`); anyone can read/write the whole DB. | B |
| C2 | Auth | Login + session are client-side (`localStorage erp_session_token`); editing it to role CEO is trusted. | B |
| C3 | Authz | `src/lib/api/*` has almost no permission checks; roles are enforced only in the UI. | B |
| C4 | Bootstrap | `initTursoDB()`+`seedCRMData()` run in **every visitor's browser** on load (App.tsx): CREATE/ALTER TABLE, INSERT settings, `syncLocalStorageToTurso` (INSERT OR REPLACE of the visitor's localStorage blog posts → stale copies overwrite edited posts / resurrect deleted ones), and demo CRM rows (Rahul Demo, CNX-2026-0001…) inserted into prod when `leads` is empty. | A |
| C5 | Secrets | Hardcoded **Deepgram key** fallback in `student.ts textToSpeech`; Groq/Gemini/Deepgram/Bunny keys are `VITE_*` (shipped). Earlier-fixed Turso/Razorpay literals remain in git history. | A (+rotate) |
| C6 | PII | `students_seed.json` (28 students: name, course, fees, joining date) imported into the public JS bundle; Aadhaar/other docs stored as base64 in `students` table and returned by `SELECT *`. | A / C |
| C7 | Payments | No identity or verification chain: EnrollPage posts to a Google Sheet before paying and never links the payment id; PreRegistration stores nothing after paying; `/pay` UPI flow only `console.log`s; Netlify `verify-payment` logs nothing; all pages show "Payment verified/received" even when `verified:false`; EnrollPage passes `prefill` (ignored — option is `customer`) so Razorpay never gets name/email/phone and `notes` has no identity. | A (+B for DB record) |
| C8 | Payments | Prices/coupons are client-side (PreRegistration base 2000, coupons SAVE25/CYNEX50/LAUNCH70 shown publicly, no expiry/limits); `create-order` accepts any amount; EnrollPage fixed 500 in client. | A (server price) |
| C9 | Assessment | Answer keys ship to the student (`class_questions.correct_answer_idx`, `test_cases_json`, mock-test `correctAnswer`, `sqlAssessment` answers); correctness/scores/coins are decided in the browser and written by the student's client. | B |
| C10 | Grading | **Fake graders:** `QuizzesPage` + `AssessmentStudioPage` "Run" always prints "ALL TEST CASES PASSED" without executing code; every code submit is stored `is_correct=1`; ClassFlow marks ALL coding questions correct (`isCorrect=true`, empty `onRunSuccess`); mock-interview fallback score `min(max(turns*1.5,5),9.5)`. | A |
| C11 | Passwords | AES-reversible (key shipped), `password_hash` holds the same ciphertext, `getUsers` returns every user's ciphertext, admin UIs decrypt and display plaintext, `saveErpUser` stores plaintext, `getUserPasswordEncrypted` hands any ciphertext to the caller, no change-password feature anywhere. | B / C |
| C12 | Privilege | Role dropdown in UserManagement offers CEO/Admin to Managers (can create/promote CEO); `approveStudent` resets password+Active on ANY existing user with that email (even staff). | A |
| C13 | Live class | Jitsi room is the public `meet.element.io/CynexAIClass<classId>` (predictable, no lobby/lock). | A / C |
| C14 | Attendance | QR attendance is fake: teacher QR is a random string stored nowhere; student side accepts ANY string as classId (also from the manual box), result of `logQRAttendance` ignored (shows success even on failure); online attendance = browser timer + client-supplied minutes; `submitOnlineAttendance` allows 'upcoming' classes and overwrites Absent. | A (+B) |
| C15 | Certificates | `saveCertificate` falls back to localStorage and returns true when the DB write fails → certificate looks issued but public QR verification (DB) fails; verify page ignores `status` (no revoke), no rate limit, ids `CX-<Date.now()>` enumerable, returns full `file_data`. | A |
| C16 | Data corruption | `updateStudentLeadStatus(email,phone)`: when phone/email is '' it runs `WHERE email='' OR phone=''` → marks every blank-phone/email lead (CSV email-only imports) as Closed Won. | A |
| C17 | CRM | `getLeads()` returns 4 FAKE leads (Rahul Kumar, Priyanka Sharma, …) when the DB is empty/unreachable → sales staff act on fake people. | A |

---
## 2. High — app logic bugs (wrong results/data loss)
### Student / learning
- **L1** Dashboard module list ignores the course: `LEFT JOIN course_module_mapping … (cmm.course_id = ? OR … 'course_ds_mastery')` has no WHERE → every course's modules shown; hardcoded `course_ds_mastery`. (student.ts) — A
- **L2** Falls back to "first course" and "latest timetable slot of any batch" when none match. — A
- **L3** Module/class "completed" counts `classes.status in (completed,ended)` which is global (teacher ended it for everyone) → every student's progress inflated; attendance rate numerator counts Manual/Online rows even if Absent, denominator = classes of ALL courses. — A
- **L4** Managers' Students/StudentProgress pages show **fabricated students** from `students_seed.json` with generated streak/coins/badges/attendance when the DB returns 0 rows or errors; defaults: phone 9876543210, join 2026-06-01, hardcoded course names and batches '1'..'5'; real rows get `attendancePct:0`. — A
- **L5** `saveQaResponse`: +5 coins on every correct submit (no per-question uniqueness; reload lets answered questions be answered again), no check the question belongs to the class. `saveMockInterview`/coins: client-supplied `coinsAwarded`/`score`; `spendCoins` read-then-write race and negative amounts add coins; `adjustStudentMetrics(field)` interpolates a column name. Manager's "Gamification Settings" (enabled/reward amount) is NOT used by any award path (`awardGamificationCoins` unused). — A (B for trust)
- **L6** Streak = days-active counter that never resets; JS UTC date vs SQLite date('now') (UTC) → IST users off by a day near midnight. — A
- **L7** "Mark as completed" has no watch requirement (5-min rule removed) → instant completion/streak/progress.
- **L8** `getClassFlowData`: timetable slot → always the first class of the course (LIMIT 1) not the slot's class.
- **L9** Quizzes: completion on ANY submission regardless of score (0/4 passes), unlimited retakes, `INSERT OR REPLACE` with random id (duplicates), writes `answer_text` while student.ts writes `answer_idx`/`code_answer` (schema drift; errors swallowed `.catch(()=>{})` yet progress still marked); fabricates 4 MCQ / 2 coding counts and generic placeholder questions with a hardcoded answer key; loads answer keys of the whole curriculum.
- **L10** `updateStudentModuleProgress('add')` inserts a dummy class "Manual Progress Step" (order 999) into `classes` when nothing is left → pollutes curriculum seen by all students.
- **L11** Leaderboard only lists students with ≥1 Completed referral (coins ignored); `referrals` table is never INSERTed by any code (ReferralCenter/leaderboard always empty) while CEO payouts read `sales.referred_by_student_id` → students never see rewards; `/student/leaderboard|referrals|rewards` routes just redirect to /student.
- **L12** StudentLayout sidebar queries `badges`/progress by `users.id` but badges are written with `students.id` (counts mismatch); progress bar forces min 5%.

### Teacher / attendance / timetable / batches
- **T1** Attendance "present" = duration≥5 OR status Present OR type Offline_QR **OR type Manual** → an explicit **Absent** row typed Manual shows as Present (matrix, calendar, student attendance rate); marking Absent flips back after next sync.
- **T2** `DEFAULT_DEMO_STUDENTS` fake roster on empty/error; fabricated "Python – Class 1..28"/"SQL – Class 1..30" columns (attendance rows written to fake ids); "Copy Meet link" invents `meet.google.com/cnx-<id>`.
- **T3** Batch roster uses `includes()` both ways → "Batch 10/11/12" students appear under "Batch 1" (same in Students.tsx `isBatchMatchingCourse`).
- **T4** Teacher scoping hardcodes `usr_teacher`, `usr_teacher_venkat`, `teacher@cynexai.com` (everyone sees Venkat's modules/slots); fallbacks return ALL modules / any non-completed class (a teacher can start another teacher's class); start-class does not check ownership or an existing live class; class `status` is global across batches.
- **T5** `postponeClass` overwrites the recurring slot's `start_time` permanently for a one-off postponement (end_time unchanged, date ignored); announcements store `batch_id` but students see all batches' announcements.
- **T6** `completeClassWithSummary(…, ytUrl||null)` overwrites `youtube_video_id` with NULL when the teacher leaves the URL empty (replay lost); swallows DB errors; if the AI summary fails the class stays `in_progress`.
- **T7** `ensureClassQuestions` is triggered from 3 places without awaiting → duplicate AI questions; `correct_answer_idx ?? 0` makes answer #1 the key when the AI omits it.
- **T8** Batches: `students.batch_number` is free text (not FK) — renaming a batch orphans students, `deleteBatch` leaves students/slots; fake default progress (SQL 5/10, Python 3/10, AI 4/10, ML 5/10) seeded into every new batch; progress unlock sets GLOBAL `classes.status='unlocked'` via `LIKE '%subject%'`; `updateBatch` resets name/status/max_students/course/teacher when fields are omitted; no capacity check; `current_enrolled` stored + recomputed.
- **T9** Timetable: no overlap/conflict check; week filter pulls all past slots into the current week; legacy fallback hardcodes 'Data Science & AI'.
- **T10** Cache keys: `checkTeacherAssignment` caches under `teacher_assigned_<id>` but timetable saves invalidate `teacher_check` → a newly assigned teacher can't open the Teacher portal for up to 5 min; `announcements`/`job_listings` invalidations don't clear the student keys.

### CRM / sales / approvals
- **S1** SaleForm course list is hardcoded (`data_science`,`full_stack`,`ai_ml`) → `sales.course_id` never matches `courses.id` (student dashboard chain fails → wrong course); no validation (paid ≤ total, positive); `recordSale` failure ignored; double-submit → duplicate sales; discount_locked/expiry never applied. (`recordSale` now atomic.)
- **S2** `recordAdmission` sets lead 'Admission' but the board has 'Admission Completed'; `recordSale` sets 'Closed Won' (no column) → the lead **disappears from the pipeline** after the forms. Status vocabulary differs between flows/analytics.
- **S3** `updateLeadStatus` reassigns the lead to whoever drags it (steals leads); dragging to Closed Won / Partial / Admission creates no sale/admission/approval; opening an unassigned lead auto-claims it.
- **S4** CSV import: `h.includes('name')` lets "Course Name/College Name" overwrite the lead name; naive `split(',')`; no dedupe; per-row awaits; phone stored digits-only vs raw elsewhere.
- **S5** `approveSale` isn't idempotent (double approve = duplicate students), 4 writes non-atomic, marks Approved before checking the sale, creates **no login/user row** for the student, student has no name/phone, student_code random 4 digits without uniqueness; email dispatch is `console.log`; ApprovalDetail checklist not persisted; after approve/reject it navigates to non-existent `/crm/manager` (blank page).
- **S6** CRM analytics: `monthlyData` uses `ORDER BY name ASC LIMIT 6` = oldest six months; executive/monthly ignore date range/user; end date excluded; revenue includes unapproved/rejected; three revenue definitions across admin/manager/crm dashboards; CEO "Conversion" = students/leads (can exceed 100%).
- **S7** `deleteLead`/`deleteUser`/`deleteClass`/`deleteCourse`/`deleteBatch`: hard deletes with no cascade/guard/soft delete; can delete yourself/last CEO.
- **S8** WhatsApp links drop the country code (LeadDetail, Panel, Pipeline, Chat) and the backend formats `phone+@c.us` without it → 10-digit Indian numbers fail; bulk sender ignores failures and always says "complete".
- **S9** Duplicate implementations (createLead ×2, activity writer ×2, materials ×2, blog ×2, cache ×2) with different columns/semantics.

### Staff / users / tasks / reports
- **U1** Editing a student's email creates a duplicate user+student (lookup by the new email); `saveStudent`+`updateStudentProfile` non-atomic; `updateStudentProfile`/`patchUser`/`updateTask`/`updateProject`/`updateBlogPost`/marketing updates build `SET` from caller keys (mass assignment/column injection). (patchUser fixed earlier.)
- **U2** `bulkImportStudents`: codes restart at CNX-YYYY-0001 each run; `INSERT OR IGNORE` silently drops rows but `imported++`; shared default password `cynex123`; no transaction.
- **U3** Staff attendance: `logOfficeAttendance('login')` fires on every page load; re-login wipes a closed session's logout/duration; tab close never logs out → cleanup sets logout to 23:59:59 (inflated hours); cleanup UPDATEs run inside a read.
- **U4** Employee reports N+1 (6–7 queries/user), tasks `created_by` counted as the creator's own, conversions/calls ignore date range, parallel time logs allowed.
- **U5** Tasks: "Stop daily recurrence" doesn't work (part 1 recreates today's copy ignoring `stopped`); `ensureDailyTasks` writes during every user's read → duplicate dailies; no authz on subtasks/dependencies/recurrence; `createTask` swallows errors and returns an id; comment/activity author names join the legacy `erp_users`.
- **U6** `settings.setSetting` with `user_id NULL`: SQLite treats NULLs as distinct so `ON CONFLICT` never fires → each save inserts a duplicate row and `getSetting` returns the oldest → global settings never update.
- **U7** History page truncates five sources (LIMITs 150/250/200/200/50) *then* filters → incomplete audit; wrong timestamps/attribution; mixed `T..Z` vs `YYYY-MM-DD HH:MM:SS` timestamps (local-time parsing shifts IST by 5.5 h); CSV export truncates at `#` and has formula injection.

### Public site / content
- **P1** DM "Jobs" live only in each admin's localStorage while students read DB `job_listings`; `triggerJobScraper` fabricates a job; DM SEO settings/keywords are localStorage-only (no effect); marketing metrics/campaigns show invented defaults and metric updates are UPDATE-only.
- **P2** Blog newsletter, teacher SQL workspace and Excel/CSV importer are fake (canned output / hardcoded table).
- **P3** Profile "My Performance" shows hardcoded 12/4/1/8 to every Sales/Manager.
- **P4** Mock-test portal (/test): unauthenticated, free-text name, answers + scoring in browser, results forgeable, unlimited attempts, silent mock-success when DB is down.
- **P5** Dead links/no 404: `/brochure`, `/courses`, `/crm/manager`; no `path="*"` route (blank page); Admin role routed to `/sales/dashboard` (restricted); login ignores `state.from`.
- **P6** Stored-URL XSS vector: job `source_url`, material `file_url`, `doc_url`, `meet_link` rendered as `href` without scheme check (`javascript:`).

---
## 3. Medium / scalability / hygiene
- Polling load: class page 3 s per student; attendance matrix reads the whole `attendance_logs` table every 8 s; `getManagerStudents LIMIT 200` truncates; `getLeads`/`getAllTasks` return everything.
- Timezone: all "today" uses UTC (`toISOString().split('T')[0]`) — IST 00:00–05:30 is the previous day (attendance, tasks, streak, reports).
- Identity: student referenced as users.id / students.id / email depending on table → every query ORs 3–4 forms (slow, double counts).
- Client-side DDL (`ensureAttendanceSchema`, `ensureBatchesTable`, `postponeClass`, staff attendance) and build-time prod schema sync.
- `getTeachersList` matches `email LIKE '%teacher%'`; `findPendingTaskForEntity` uses `description LIKE '%id%'`; ids from `Date.now()`/`Math.random()`.
- 346 TS errors, 829 ESLint errors, no CI; components run SQL directly (QuizzesPage, AssessmentStudio, Students, BatchesTab, StudentLayout, TimeTracker).
- Placeholder channel in YouTube Studio link; unused deps; duplicate/legacy tables (`leads`/`crm_leads`, `users`/`erp_users`).

---
## 4. Not fully reviewed (skimmed only)
PlacementDashboard (own hardcoded `cynexai800/admin123` gate), DMDashboard, ContentPlanner, TimetableManager, StudentProgress, CourseManagement/ModuleEditor/ClassEditor, Asana task UI, ModuleMap, CareerCenter, PresentationView, CodeWorkspace, JitsiMeet, TTS backend, `scripts/*`.

---
## 5. Fix plan (no change to the core flow)
1. **Batch 1 – safe code fixes (class A)**: R1, C4, C5, C6(bundle), C7(verified flag + identity in notes + record), C8(server price), C10, C12, C14(partial), C15, C16, C17, L1–L10, T1–T7, T10, S1–S6, U1–U7, P1–P6. Each keeps the same screens and function names.
2. **Batch 2 – server layer (class B)**: Netlify functions for login/session + authenticated DB proxy with role policy; server-side scoring, coins, attendance tokens, payments recording. Swap `client` in `turso.ts` so the UI is untouched.
3. **Then** move to `ops.cynexai.in`.
