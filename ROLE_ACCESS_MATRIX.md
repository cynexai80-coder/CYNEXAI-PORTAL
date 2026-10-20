# Role-access route matrix

Measured 20 Oct 2026 in a browser against the **local seeded database** (never production). The first run was read-only and found the gaps listed in section 2; the fixes in section 3 were then applied and **the whole matrix was re-measured** (sections 1 and 5). Nothing is committed.

- **Who:** the 7 roles (CEO, Manager, Sales/HR, DM, Teacher, Admin, Student) plus a visitor who is not logged in. Each role logged in through the real login form with its seeded account. None of the seeded accounts has `permissions_json`, so **role defaults apply** (the situation of every user without custom module permissions).
- **What:** 105 routes from `src/App.tsx` (79 protected), with sample ids for the parameter routes. Each route was opened by client-side navigation for every role; 31 targeted cases (cross-role pages, trailing slash, capitalisation) were repeated with a full page load, before and after, and agreed.
- **Result per cell:** ● the page opens · ✕ the "Access Restricted" page · →L sent to the login page · 404 · ↪ redirected.
- **"Declared roles"** = the roles a route's wrappers allow (`allowedRoles` on the route and on its layout). Where a route has two lists, the **intersection** is shown.

## 1. Result: before and after the fix

| | Before | After |
|---|---|---|
| Pages a Teacher / Sales / DM / Manager could open **outside** the route table's roles | 20 / 17 / 16 / 15 (68 total; 66 reachable only by typing the URL) | **0 / 0 / 0 / 0** |
| Teacher on `/ceo/dashboard` | opened, showing **revenue ₹63,000, payroll ₹520,000**, leads, conversion | Access Restricted |
| Manager on `/ceo/settings` (API-key and database-token fields) | opened | Access Restricted |
| `/manager/certificates/`, `/Manager/Certificates`, `/dm/planner/`, `/teacher/student-progress/` … (trailing slash / other case) | opened although the page without the slash was refused | refused, all spellings |
| Student on `/chat` | opened; Bulk Sequencer listed **28 leads with phone numbers** | Access Restricted (Admin too) |
| Manager menu "Reports" | 404 (`/manager/reports` had no route) | opens |
| Menu links that do not open for the role | 1 (Manager) | 0 (Admin's footer "About Us" is the known /about 404) |
| Visitor on protected routes | login page on all 78 | login page on all 79 |
| CEO | opens everything | unchanged (also opens `/student/*`, by design) |

Still true after the fix, and not something UI changes can solve: **the session is editable** (as Student, setting `role` to `CEO` in `localStorage` still opens `/ceo/users` and `/admin/dashboard`) and the browser holds the database token. That is the server layer in `SERVER_LAYER_PLAN.md`.

## 2. What the first run found (before the fix)

**RC-1 — a module permission replaced the role check** (`RequireAuth.tsx`). If the route was in `ROUTE_MODULE_MAP`, the role list on the route was skipped and only "does the user have the module?" decided. Role defaults give **every staff role** the modules `dashboard`, `tasks` and `courses`, and the map assigned every role's own dashboard/tasks/course page to the same module, so a Teacher "had the dashboard module" and opened the CEO's Master View, the Manager Hub and the other dashboards.

**RC-2 — the lookup was an exact string match** on `location.pathname`. `/manager/certificates` was refused, but `/manager/certificates/` or `/Manager/Certificates` was not found in the map, the module check was skipped, and the page opened.

**RC-3 — `/chat` and `/profile` used the "any logged-in user" layout**, including Students and Admins, although the Chat Center is a staff tool.

| # | Finding | Severity | Status |
|---|---|---|---|
| M-1 | Teacher / Sales / DM / Manager opened 66 pages of other roles by URL (CEO Master View with revenue and payroll, Manager Hub, Sales and DM hubs, the CEO's Task Center, the audit log, Staff Management, student directory …) | High | **Fixed** |
| M-2 | Trailing slash or different capitalisation skipped the module check (a module the CEO switched off did not stay off) | High | **Fixed** |
| M-3 | Students and Admins could open `/chat`; as Student the Bulk Sequencer listed every lead with phone number and offered bulk WhatsApp | High | **Fixed** (staff roles only) |
| M-4 | Manager could open the CEO's Global Settings (OpenAI, Twilio, Turso URL/token fields; the page says "Only CEO …") | High | **Fixed** |
| M-5 | Defaults deny pages the route table allows: Manager → `/manager/certificates`, `/dm/planner`, `/teacher/settings`; Teacher → `/teacher/student-progress` | Medium | **Open: needs a decision** (see below) |
| M-6 | Manager's menu "Reports" went to `/manager/reports`, which had no route (404) | Medium | **Fixed** |
| M-7 | Admin role opens only `/admin` (blog management); `/admin/dashboard` ("Admin Overview") is CEO-only | Medium | Open: decide what Admin should do |
| M-8 | List pages opened cross-role through the module while their detail routes were refused | Low | Gone with M-1 |
| M-9 | "Role page access" (`rolePageAccess.ts`) cannot be changed from anywhere; nothing calls `setRolePages`, and it is stored in `localStorage` | Low | Open (finish or delete) |
| M-10 | Session editable in `localStorage` (known C2) | High | Open: server layer |

*M-5 decision:* the role defaults in `auth.ts` (`ROLE_DEFAULT_PERMISSIONS`) leave out `certificates` for Manager and `students` for Teacher although the route table and `pageRegistry` list those roles. This is the known decision D-6 for Teachers. Until you decide, these four pages stay closed, now for every spelling of the URL. Opening them is one line per module in `ROLE_DEFAULT_PERMISSIONS`.

## 3. What was changed

Rules, now in one place (`decideRouteAccess` in `src/lib/permissionsRegistry.ts`, called by `RequireAuth`):

1. The CEO opens everything.
2. A page with no module is decided by the route's allowed roles.
3. A module that is **off** for the user closes its pages, whatever the role list says.
4. A role listed on the route opens it (module on).
5. A module grant **adds** access only when the CEO set it explicitly (`permissions_json`), and only to that module's own page for the role (the sidebar link). **Role defaults never open another role's pages.**
6. The path is normalised (lower-case, no trailing slash) before any lookup.

| File | Change |
|---|---|
| `src/lib/permissionsRegistry.ts` | `normalisePath`, `getModuleRoute` (the module → page table that used to live inside the sidebar), `hasExplicitPermissions`, `decideRouteAccess` |
| `src/components/layout/RequireAuth.tsx` | uses `decideRouteAccess` instead of the exact-path module lookup |
| `src/components/layout/Sidebar.tsx` | takes menu routes from `getModuleRoute`; a default (non-explicit) user no longer gets duplicate `/ceo/*` links (Manager lost "CRM Pipeline" and "Sales History" under `/ceo/…`; the same pages stay at `/sales/…`) |
| `src/App.tsx` | `/chat` now uses `ChatLayout` (CEO, Manager, Sales/HR, DM, Teacher); new route `/manager/reports`; `/ceo/reports` is CEO-only (its outer wrapper contradicted its inner one) |
| `src/seo/portalTitles.ts` | title for `/manager/reports` |
| `src/lib/routeAccess.test.ts` (new, 15 tests) | the rules above with the exact cases from this matrix, plus a check that every route in the permission map and every menu link a module can produce exists in `App.tsx` (this would have caught the `/manager/reports` 404) and that `/chat` stays staff-only |
| `src/components/layout/RequireAuth.test.tsx` (new, 5 tests) | component test: visitor → login, Teacher refused on the CEO dashboard, trailing-slash/case refused, Student refused on `/chat`, CEO allowed |

Checks: the new tests fail against the old behaviour (6 of them did when the old logic was put back) and pass now; full suite 178 / 178; `tsc` 297 errors, same set as before.

## 4. Not covered
- Users with custom `permissions_json` in a browser (covered by unit tests only).
- A Teacher who is not assigned to a class; a Sales/HR or Manager user who is assigned (they get the Teacher portal through `checkTeacherAssignment`; unit-tested, not browsed).
- What each page can do once open (this is about getting in; no write actions were performed).
- The database itself: until the server layer exists, anyone with the browser's token can read and write everything regardless of the UI.

## 5. Matrix (after the fix)


Legend: ● opens · ✕ "Access Restricted" page · →L sent to /login · 404 not-found page · ↪ redirected to the path shown · ◌ blank · ●! opens but shows an error message · ? not probed

| Route | Declared roles (App.tsx) | Module | CEO | Manager | Sales/HR | DM | Teacher | Admin | Student | Anonymous |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **CEO** | | |  |  |  |  |  |  |  |  |
| `/ceo/ai-settings` | CEO | ai_voice | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/ai-voice` | CEO | ai_voice | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/attendance` | CEO | attendance | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/certificates` | CEO | certificates | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/courses` | CEO | courses | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/courses/course_ds/modules/mod_sql` | CEO |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/courses/course_ds/modules/mod_sql/classes/mod_sql_c1` | CEO |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/dashboard` | CEO | dashboard | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/dm-dashboard` | CEO | marketing | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/gamification` | CEO | gamification | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/history` | CEO | sales_history | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/reports` | CEO | reports | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/sales-dashboard` | CEO | sales | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/sales-pipeline` | CEO | sales | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/sales-pitch` | CEO | courses | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/settings` | CEO | settings | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/student-progress` | CEO | students | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/student-settings` | CEO | settings | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/students` | CEO | students | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/tasks` | CEO | tasks | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/timetable` | CEO | timetable | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/ceo/users` | CEO | users | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| **Manager** | | |  |  |  |  |  |  |  |  |
| `/manager` | Manager, CEO | dashboard | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/approvals/sal_1` | Manager, CEO |  | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/assign-batch/sal_1` | Manager, CEO |  | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/attendance` | Manager, CEO | attendance | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/certificates` | Manager, CEO | certificates | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/courses` | Manager, CEO | courses | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/courses/course_ds/modules/mod_sql` | Manager, CEO |  | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/courses/course_ds/modules/mod_sql/classes/mod_sql_c1` | Manager, CEO |  | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/gamification` | Manager, CEO | gamification | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/reports` | Manager, CEO | reports | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/student-progress` | Manager, CEO | students | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/student-settings` | Manager, CEO | settings | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/students` | Manager, CEO | students | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/tasks` | Manager, CEO | tasks | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/timetable` | Manager, CEO | timetable | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/manager/users` | Manager, CEO | users | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| **Sales/HR** | | |  |  |  |  |  |  |  |  |
| `/sales/courses` | Sales/HR, Manager, CEO | courses | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/courses/course_ds/modules/mod_sql` | Sales/HR, Manager, CEO |  | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/courses/course_ds/modules/mod_sql/classes/mod_sql_c1` | Sales/HR, Manager, CEO |  | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/dashboard` | Sales/HR, Manager, CEO | dashboard | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/history` | Sales/HR, Manager, CEO | sales_history | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/leads/lead_1` | Sales/HR, Manager, CEO |  | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/leads/new` | Sales/HR, Manager, CEO |  | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/pipeline` | Sales/HR, Manager, CEO | sales | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/pitch` | Sales/HR, Manager, CEO | courses | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| `/sales/tasks` | Sales/HR, Manager, CEO | tasks | ● | ● | ● | ✕ | ✕ | ✕ | ✕ | →L |
| **DM** | | |  |  |  |  |  |  |  |  |
| `/dm/courses` | DM, Manager, CEO | courses | ● | ● | ✕ | ● | ✕ | ✕ | ✕ | →L |
| `/dm/courses/course_ds/modules/mod_sql` | DM, Manager, CEO |  | ● | ● | ✕ | ● | ✕ | ✕ | ✕ | →L |
| `/dm/courses/course_ds/modules/mod_sql/classes/mod_sql_c1` | DM, Manager, CEO |  | ● | ● | ✕ | ● | ✕ | ✕ | ✕ | →L |
| `/dm/dashboard` | DM, Manager, CEO | dashboard | ● | ● | ✕ | ● | ✕ | ✕ | ✕ | →L |
| `/dm/planner` | DM, Manager, CEO | marketing | ● | ✕ | ✕ | ● | ✕ | ✕ | ✕ | →L |
| `/dm/tasks` | DM, Manager, CEO | tasks | ● | ● | ✕ | ● | ✕ | ✕ | ✕ | →L |
| **Teacher** | | |  |  |  |  |  |  |  |  |
| `/teacher` | Teacher, Manager, CEO | dashboard | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/attendance` | Teacher, Manager, CEO | attendance | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/cms` | Teacher, Manager, CEO | courses | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/courses` | Teacher, Manager, CEO | courses | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/courses/course_ds/modules/mod_sql` | Teacher, Manager, CEO |  | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/courses/course_ds/modules/mod_sql/classes/mod_sql_c1` | Teacher, Manager, CEO |  | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/live` | Teacher, Manager, CEO | classes | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/presentation-view` | Teacher, Manager, CEO |  | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/settings` | Teacher, Manager, CEO | ai_voice | ● | ✕ | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/student-progress` | Teacher, Manager, CEO | students | ● | ● | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| `/teacher/tasks` | Teacher, Manager, CEO | tasks | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| `/teacher/timetable` | Teacher, Manager, CEO | timetable | ● | ● | ✕ | ✕ | ● | ✕ | ✕ | →L |
| **Student** | | |  |  |  |  |  |  |  |  |
| `/student` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/assessment/mod_sql_c1` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/attendance` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/career` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/class` | → /student/classes |  | ↪ /student/classes | ✕ | ✕ | ✕ | ✕ | ✕ | ↪ /student/classes | →L |
| `/student/class-flow` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/classes` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/interview` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/leaderboard` | → /student |  | ↪ /student | ✕ | ✕ | ✕ | ✕ | ✕ | ↪ /student | →L |
| `/student/module/mod_sql` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/quizzes` | Student |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ● | →L |
| `/student/referrals` | → /student |  | ↪ /student | ✕ | ✕ | ✕ | ✕ | ✕ | ↪ /student | →L |
| `/student/rewards` | → /student |  | ↪ /student | ✕ | ✕ | ✕ | ✕ | ✕ | ↪ /student | →L |
| **Admin** | | |  |  |  |  |  |  |  |  |
| `/admin` | Admin, CEO |  | ● | ✕ | ✕ | ✕ | ✕ | ● | ✕ | →L |
| `/admin/dashboard` | CEO |  | ● | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | →L |
| **Shared** | | |  |  |  |  |  |  |  |  |
| `/chat` | CEO, Manager, Sales/HR, DM, Teacher |  | ● | ● | ● | ● | ● | ✕ | ✕ | →L |
| `/profile` | any login |  | ● | ● | ● | ● | ● | ● | ● | →L |
| **Public / other** | | |  |  |  |  |  |  |  |  |
| `/` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/apply/course_ds` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/blog` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/blog/blog_0` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/certificate/CX01920` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/course/course_ds` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/courses/pre-registration` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/crm/leads` | → /sales/pipeline |  | ↪ /sales/pipeline | ↪ /sales/pipeline | ↪ /sales/pipeline | ✕ | ✕ | ✕ | ✕ | →L |
| `/crm/leads/new` | → /sales/leads/new |  | ↪ /sales/leads/new | ↪ /sales/leads/new | ↪ /sales/leads/new | ✕ | ✕ | ✕ | ✕ | →L |
| `/enroll` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/Enroll` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/gallery` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/login` | public |  | →L | →L | →L | →L | →L | →L | →L | →L |
| `/pay` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/placement-dashboard` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/placementdashboard` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/placemnetdashboard` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/pre-registration` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/test` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/test/attempt` | public |  | ↪ /test | ↪ /test | ↪ /test | ↪ /test | ↪ /test | ↪ /test | ↪ /test | ↪ /test |
| `/test/result` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |
| `/webinar` | public |  | ● | ● | ● | ● | ● | ● | ● | ● |

| Role | Lands on after login | Sidebar links | permissions_json in session |
|---|---|---|---|
| CEO | /ceo/dashboard | 28 | no (role defaults apply) |
| Manager | /manager | 18 | no (role defaults apply) |
| Sales/HR | /sales/dashboard | 8 | no (role defaults apply) |
| DM | /dm/dashboard | 6 | no (role defaults apply) |
| Teacher | /teacher | 10 | no (role defaults apply) |
| Admin | /admin | 5 | no (role defaults apply) |
| Student | /student | 0 | no (role defaults apply) |
| Anonymous | — | 0 | — |

## 6. Menu links per role (after the fix)

Admin has no sidebar: the 5 links are the public site header/footer around the blog admin page (the footer "About Us" is the known /about 404, D-1). Student uses a separate layout.

| Role | Links (all open for that role) |
|---|---|
| Sales/HR | `/sales/dashboard` `/sales/courses` `/sales/pitch` `/sales/pipeline` `/sales/tasks` `/sales/history` `/chat` `/profile` |
| Manager | `/manager` `/manager/courses` `/sales/pitch` `/sales/pipeline` `/sales/history` `/manager/timetable` `/manager/students` `/manager/attendance` `/manager/student-progress` `/manager/users` `/manager/student-settings` `/manager/gamification` `/manager/reports` `/manager/tasks` `/teacher/live` `/chat` `/teacher/student-progress` `/profile` |
| CEO | `/ceo/dashboard` `/ceo/tasks` `/ceo/users` `/ceo/students` `/ceo/certificates` `/ceo/attendance` `/ceo/student-progress` `/ceo/courses` `/ceo/timetable` `/ceo/sales-dashboard` `/ceo/sales-pipeline` `/ceo/history` `/ceo/sales-pitch` `/ceo/dm-dashboard` `/ceo/ai-voice` `/ceo/ai-settings` `/ceo/gamification` `/ceo/student-settings` `/ceo/reports` `/ceo/settings` `/chat` `/manager/certificates` `/manager/attendance` `/teacher/student-progress` `/sales/pitch` `/sales/pipeline` `/sales/history` `/profile` |
| DM | `/dm/dashboard` `/dm/courses` `/dm/planner` `/dm/tasks` `/chat` `/profile` |
| Teacher | `/teacher` `/teacher/courses` `/teacher/timetable` `/teacher/live` `/teacher/cms` `/teacher/attendance` `/teacher/tasks` `/teacher/settings` `/chat` `/profile` |
| Admin | `/` `/gallery` `/blog` `/placementdashboard` `/about` |
| Student | — |

## 7. How this was measured (to repeat it)

Local test database (`node server.cjs` in the session scratch folder, 127.0.0.1:8787), Vite on 127.0.0.1:5199 with the local database URL, headless Chromium (Playwright). Per role: real form login, then for each route either `history.pushState` + `popstate` or a full `page.goto`; the page is classified by final URL, the "Access Restricted" / "Page not found" text and rendered text length. The scripts (`roles_probe*.cjs`, `roles_analyse.cjs`) and the raw JSON of both runs (`*_before.*` and the final one) are in the shared notes folder `C:UserskkAppDataRoamingClaudeside-session-noteslocal_c9b3ec6b-ce53-4ea6-84c1-b4d6b1a07c04ole-matrix`, not in the repo. The before-fix matrix is kept there as `matrix_before.md`.
