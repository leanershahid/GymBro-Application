# GymBro — Gaps & Missing Features Audit (2026-10-29)

Scope: the backend (`backend/.../GymManagmentApplication`), the frontend (`frontend/GymManagmentApplicationFrontend`), and the product spec (`backend/GymManagmentApplication-27-06-2026/pdf_text_clean.txt`).
Every finding was checked against the code. The key ones were also re-checked by hand: fake face match, `Alert.alert` doing nothing on web, open CORS and Swagger.

Path short forms: `B/` = backend project root, `F/` = frontend `src/`.

---

## P0 — Broken, insecure, or misleading today

| # | Gap | Where | Impact |
|---|-----|-------|--------|
| 1 | Face verification is a mock: it returns the first user in the gym who has a face encoding | `B/Application/Biometric/Services/BiometricService.cs:41-46` | Any scan grants entry and records attendance |
| 2 | Payments are mocked but saved as real (`MOCK-` gateway ref, Paid invoice). Fake payment intent; reminders do nothing | `B/Application/Billing/Services/PaymentService.cs` | Revenue counts money that was never charged |
| 3 | `Alert.alert` does nothing on react-native-web (16 files) | e.g. `F/features/member-app/screens/ProfileScreen.tsx:217`, `trainer-app/screens/TrainerProfileScreen.tsx:186` | On web (Vercel), members and trainers **can't sign out**; deletes and confirmations silently do nothing |
| 4 | Forgot-password and email OTP are generated but never sent. No email or SMS provider exists | `B/Application/Auth/Services/AuthService.cs:152-155,232-235` | Nobody can reset a password |
| 5 | Refresh, reset and OTP tokens, saved cards and bookmarks live in static memory | `AuthService.cs:25-27`, `PaymentService.cs:16-17`, `WorkoutService.cs:16` | Lost on every Render restart; can't run more than one server |
| 6 | Login session is in memory only on the frontend; no refresh token; no 401 handling | `F/api/axios.ts`, `F/api/session.ts` | A page refresh or app restart logs the user out; an expired token leaves broken screens |
| 7 | React Query cache isn't cleared on logout | `App.tsx` `logout` | The next user can briefly see the previous user's data |
| 8 | No rate limiting or lockout; OTP uses `Random.Shared` | `B/Program.cs`, `AuthService.cs:232` | Login and OTP can be brute-forced |
| 9 | CORS `AllowAnyOrigin`; Swagger exposed in production | `B/Program.cs:175,260-261` | Larger attack surface |
| 10 | Changing or resetting a password doesn't end sessions; access JWT stays valid after logout | `AuthService.cs:121-183` | A stolen token keeps working |
| 11 | Self-registration can target any gym, and Pending users can sign in | `AuthService.cs:33-47,262-270` | Strangers can join any tenant |
| 12 | Subscription upgrade accepts another gym's plan id | `B/Application/Billing/Services/SubscriptionService.cs:89` | Cross-tenant data leak |
| 13 | Attendance doesn't check for an active membership | `B/Application/Attendance/AttendanceService.cs:149,239` | Expired or cancelled members can check in |
| 14 | Uploads (member photo, documents, exercise video) save a URL but throw away the file | `MemberService.cs:197-204,265-292`, `ExerciseService.cs:109-117` | Broken images and documents |
| 15 | Member profile photo is never uploaded | `F/features/member-app/screens/ProfileScreen.tsx` | A photo change is silently lost |

## P1 — Core gym workflows missing

**Billing & membership (backend partly exists, no UI at all)**
- No screens for membership plans, subscriptions, invoices or payments, for admins or members. Members can't see their plan or expiry, renew, freeze, or view invoices.
- No real payment gateway (Razorpay or Stripe) or webhooks.
- Invoices have no tax or line items; currency is hardcoded to USD; "send" only changes the status.
- Freeze/unfreeze doesn't extend the end date; renew creates no invoice; refunds have no rules.
- Subscription usage is hardcoded (0 used, 30 days left).

**Background jobs (none exist)**
- Memberships never expire; auto-renew never runs; trials are never enforced.
- No renewal or due-payment reminders.
- Workout automation "trigger" only increments a counter.

**Scheduling**
- Classes & sessions: the `GymClass` and `ClassBooking` entities exist but there's no API or UI (booking, waitlist, roster).
- PT sessions and packages: missing entirely. Trainer earnings are always 0.

**Admin app**
- No edit form for Members, Trainers, Branches or Tenants; only the active/inactive toggle.
- No member detail page: profile, membership, attendance, notes, documents.
- Can't assign a trainer to a member. The dashboard "Assign a trainer" item only opens the member list.
- The Add button is missing on Exercises, Workouts, Plans and Leads: the props aren't passed in `AdminDashboard.tsx`.
- Can't create or edit custom roles; only `GET /roles` is used.
- Exercises, Workouts and Plans aren't access-gated in the router.

**Trainer app**
- Can't assign a workout or plan to a client. The Program Builder output never reaches members.
- Program Builder makes name-only shells: no exercises, sets or reps; no edit, delete or clone. The AI tab says "Coming soon".
- Availability is fixed at 09:00–17:00 per day.

**Member app**
- No class or PT booking, and no messaging with a trainer. Coach cards do nothing when tapped.
- Challenges are display-only: no join, progress logging or leaderboard.
- Plans can't be opened; bookmarks show no saved state and there's no saved list.
- No progress photos, body measurements or weight history. Health has read endpoints only.

**Account**
- No forgot-password, change-password, sign-up or email-verify screens, even though the backend endpoints exist.
- Admin profile is read-only.

## P2 — Quality & scalability

- **Branch isolation:** the `branch_id` claim isn't used to scope queries, so a branch admin sees every branch.
- **IDs:** new IDs are `MAX(Id)+1`, so two inserts at the same moment can clash. The resulting PK violation (23505) isn't mapped and returns a 500.
- **Paging and search:**
  - Paging isn't clamped: `page=0` gives a 500, and a huge `pageSize` dumps the whole table.
  - Trainer and exercise search only filters the page already loaded.
  - Member search fires a request on every keystroke.
  - Tenants aren't paginated.
- **Soft-deleted emails:** a deleted user's email still counts against the unique index, so re-adding that member returns a 500.
- **Time zones:** Tenant and Branch time zones are ignored, and "today" uses UTC (5.5 hours off for India).
- **Bulk imports:** no transaction and no size cap.
- **Enumeration:** the `resend-otp` response reveals whether an email exists.
- **Stubs that look real:**
  - The SSO callback always throws.
  - The SSO secret is stored in plain text.
  - Fingerprint matching compares exact hashes, so it can never match a real scan.
  - The member timeline only shows "Created".
  - Workout share does nothing.
  - WorkoutBuilder tempo, rest and timer settings aren't saved.
- **Hardcoded config:** the API URL is hardcoded (no environment profiles), and `en-IN`/₹ appear in about 37 places instead of using the tenant's currency.
- **Feedback & refresh:** no pull-to-refresh on list pages; Stats/Progress show "--" with no error state; some screens use toasts and others `Alert`.
- **Roles & passwords:** renaming a role logs out everyone in it; the password minimum is 6 characters with no other rules.

## P3 — Ops & engineering

- No tests (backend or frontend), no ESLint or Prettier, no CI.
- No health check endpoint. Serilog is referenced but not configured. No audit log.
- Migrations run on every startup, which races if there's more than one instance. The Dockerfile runs as root.
- Some indexes may be missing (memberships, payments, invoices, assignments). Nothing stops two open attendance rows per user.
- `UpdatedAt` is set by hand, so it's often stale.

## Spec coverage (59 API groups in 15 domains)

About 20 groups have code, and those are in domains 1–5 and 13. These domains are **missing entirely**:
- AI & ML: workout and diet generation, predictions, pose, chatbot.
- Analytics: revenue, retention and churn reports.
- Notifications & campaigns.
- Generic automation and webhooks.
- Integrations: payment webhooks, CRM, accounting, IoT, public API keys.
- Media & forms.
- Realtime (WebSocket/SignalR).
- Goals, transformation journal and wearables.
- Achievements and social.

**Entities with no API:** Nutrition (diet plans, food log), POS and retail, HR and payroll, lockers and equipment booking, referrals, support tickets, feature flags, and all Communication tables.

**Backend features with no UI:** Biometric, Invoice, Payment, Subscription, Membership Plans, Pricing/Coupons, Corporate, Onboarding, SSO, WorkoutBuilder, WorkoutAutomation, role management, member tags, notes, documents, bulk import, and lead follow-up and scoring.

## Suggested order
1. P0 #3, #6, #7: web logout, keeping users signed in, and clearing the cache. Small frontend fixes that unblock every user.
2. P0 #8–#13: security hardening (rate limiting, CORS, Swagger, sessions, registration, plan check, attendance membership check).
3. Real file storage (Supabase Storage), plus an email provider for reset and OTP.
4. Admin CRUD completeness: edit forms, member detail, trainer assignment, Add buttons, roles.
5. Membership & billing UI, a background expiry/reminder job, then a real payment gateway.
6. Class and PT booking; trainer assigns workouts to clients.
7. Disable the mock biometric endpoints until a real provider is integrated.
