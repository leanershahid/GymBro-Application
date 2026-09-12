-- ============================================================================
-- DemoSeed.sql — demo data covering every role (admin/trainer/client/staff)
-- and every major feature area, for local/dev testing.
--
-- Run AFTER the app has started at least once (DbSeeder.cs must already have
-- created the default Tenant, the 4 system Roles, and the 7 Modules) — this
-- script looks those up by slug/key rather than assuming their ids.
--
-- Usage:
--   psql "<connection string from appsettings.Development.json>" -f DemoSeed.sql
-- or, from psql already connected to the right database:
--   \i DemoSeed.sql
--
-- Idempotent: re-running is a no-op if the marker user (admin.seed@gym.test)
-- already exists.
--
-- Login credentials for every seeded user — password is the same for all:
--   Password@123
--   admin.seed@gym.test     -> admin
--   trainer1.seed@gym.test  -> trainer (Alex Trainer)
--   trainer2.seed@gym.test  -> trainer (Jamie Trainer)
--   client1.seed@gym.test   -> client  (Sam Client, active membership)
--   client2.seed@gym.test   -> client  (Riley Client, trial membership)
--   client3.seed@gym.test   -> client  (Morgan Client, corporate membership)
--   staff.seed@gym.test     -> staff   (unimplemented role — use this to
--                                       confirm the frontend now rejects it
--                                       instead of silently granting admin)
-- ============================================================================

DO $$
DECLARE
    -- lookups (already seeded by DbSeeder.cs)
    v_tenant        numeric(20,0);
    v_role_admin    numeric(20,0);
    v_role_trainer  numeric(20,0);
    v_role_client   numeric(20,0);
    v_role_staff    numeric(20,0);
    v_mod_workouts  numeric(20,0);
    v_mod_exercises numeric(20,0);
    v_mod_plans     numeric(20,0);
    v_mod_challenges numeric(20,0);
    v_mod_live      numeric(20,0);
    v_mod_stats     numeric(20,0);
    v_mod_aicoach   numeric(20,0);

    -- scratch
    v_base          numeric(20,0);

    -- users / branch
    v_branch        numeric(20,0);
    v_admin         numeric(20,0);
    v_trainer1      numeric(20,0);
    v_trainer2      numeric(20,0);
    v_client1       numeric(20,0);
    v_client2       numeric(20,0);
    v_client3       numeric(20,0);
    v_staff1        numeric(20,0);
    v_tp1           numeric(20,0); -- TrainerProfile for trainer1
    v_tp2           numeric(20,0); -- TrainerProfile for trainer2

    -- billing
    v_plan_basic    numeric(20,0);
    v_plan_premium  numeric(20,0);
    v_corp1         numeric(20,0);
    v_gm1           numeric(20,0);
    v_gm2           numeric(20,0);
    v_gm3           numeric(20,0);
    v_inv1          numeric(20,0);
    v_inv3          numeric(20,0);
    v_gw1           numeric(20,0);
    v_coupon1       numeric(20,0);

    -- CRM
    v_lead1         numeric(20,0);
    v_lead2         numeric(20,0);
    v_lead3         numeric(20,0);

    -- training library
    v_muscle_chest  integer;
    v_muscle_back   integer;
    v_muscle_legs   integer;
    v_muscle_core   integer;
    v_equip_barbell integer;
    v_equip_dumbbell integer;
    v_equip_bodyweight integer;
    v_ex_bench      numeric(20,0);
    v_ex_squat      numeric(20,0);
    v_ex_deadlift   numeric(20,0);
    v_ex_plank      numeric(20,0);

    -- workouts / plans
    v_wt1           numeric(20,0);
    v_wt2           numeric(20,0);
    v_sec1          numeric(20,0);
    v_sec2          numeric(20,0);
    v_wa1           numeric(20,0);
    v_wa2           numeric(20,0);
    v_wl1           numeric(20,0);
    v_wp1           numeric(20,0);
    v_wpw1          numeric(20,0);
    v_wpw2          numeric(20,0);

    -- trainer scheduling
    v_pst1          numeric(20,0);
    v_pst2          numeric(20,0);

    -- classes
    v_ct1           numeric(20,0);
    v_gc1           numeric(20,0);

    -- gamification
    v_chal1         numeric(20,0);
    v_ach1          numeric(20,0);

    -- facility / access
    v_dev1          numeric(20,0);
BEGIN
    IF EXISTS (SELECT 1 FROM "Users" WHERE "Email" = 'admin.seed@gym.test') THEN
        RAISE NOTICE 'Demo seed already applied — skipping.';
        RETURN;
    END IF;

    -- ── Lookups ─────────────────────────────────────────────────────────────
    SELECT "Id" INTO v_tenant FROM "Tenants" ORDER BY "Id" LIMIT 1;
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION 'No tenant found — start the app once first so DbSeeder can run.';
    END IF;

    SELECT "Id" INTO v_role_admin   FROM "Roles" WHERE "TenantId" = v_tenant AND "Slug" = 'admin';
    SELECT "Id" INTO v_role_trainer FROM "Roles" WHERE "TenantId" = v_tenant AND "Slug" = 'trainer';
    SELECT "Id" INTO v_role_client  FROM "Roles" WHERE "TenantId" = v_tenant AND "Slug" = 'client';
    SELECT "Id" INTO v_role_staff   FROM "Roles" WHERE "TenantId" = v_tenant AND "Slug" = 'staff';

    SELECT "Id" INTO v_mod_workouts   FROM "Modules" WHERE "Key" = 'workouts';
    SELECT "Id" INTO v_mod_exercises  FROM "Modules" WHERE "Key" = 'exercises';
    SELECT "Id" INTO v_mod_plans      FROM "Modules" WHERE "Key" = 'plans';
    SELECT "Id" INTO v_mod_challenges FROM "Modules" WHERE "Key" = 'challenges';
    SELECT "Id" INTO v_mod_live       FROM "Modules" WHERE "Key" = 'live-coaching';
    SELECT "Id" INTO v_mod_stats      FROM "Modules" WHERE "Key" = 'stats';
    SELECT "Id" INTO v_mod_aicoach    FROM "Modules" WHERE "Key" = 'ai-coach';

    -- ── Branch ──────────────────────────────────────────────────────────────
    v_branch := (SELECT COALESCE(MAX("Id"),0) FROM "Branches") + 1;
    INSERT INTO "Branches"
        ("Id","TenantId","ParentId","Name","Code","Status","Address","City","State","Country","Zip",
         "Lat","Lng","Phone","Email","Timezone","Capacity","LogoUrl","Meta","CreatedAt","UpdatedAt")
    VALUES
        (v_branch, v_tenant, NULL, 'Downtown Branch', 'DT01', 0, '123 Main St', 'Metropolis', 'NY', 'USA', '10001',
         NULL, NULL, '+1-555-0100', 'downtown@gym.test', 'America/New_York', 200, NULL, NULL, now(), now());

    -- ── Users (one per role) ────────────────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "Users");
    v_admin    := v_base + 1;
    v_trainer1 := v_base + 2;
    v_trainer2 := v_base + 3;
    v_client1  := v_base + 4;
    v_client2  := v_base + 5;
    v_client3  := v_base + 6;
    v_staff1   := v_base + 7;

    INSERT INTO "Users"
        ("Id","TenantId","BranchId","RoleId","Uuid","Email","Phone","PasswordHash","FirstName","LastName",
         "AvatarUrl","Gender","Dob","Status","EmailVerifiedAt","PhoneVerifiedAt","LastLoginAt","LoginCount",
         "FaceEncoding","BiometricHash","PreferredLanguage","NotificationPrefs","Notes","CustomFields","DeletedAt",
         "CreatedAt","UpdatedAt")
    VALUES
        (v_admin, v_tenant, v_branch, v_role_admin,
         '11111111-1111-1111-1111-111111111111', 'admin.seed@gym.test', '+1-555-0001',
         'FF7BD97B1A7789DDD2775122FD6817F3173672DA9F802CEEC57F284325BF589F',
         'Ava', 'Admin', NULL, 1, DATE '1988-04-12', 0, now(), now(), now(), 0,
         NULL, NULL, 'en', NULL, 'Seed data admin account.', NULL, NULL, now(), now()),

        (v_trainer1, v_tenant, v_branch, v_role_trainer,
         '22222222-2222-2222-2222-222222222222', 'trainer1.seed@gym.test', '+1-555-0002',
         'FF7BD97B1A7789DDD2775122FD6817F3173672DA9F802CEEC57F284325BF589F',
         'Alex', 'Trainer', NULL, 0, DATE '1992-06-20', 0, now(), now(), now(), 0,
         NULL, NULL, 'en', NULL, 'Seed data trainer account.', NULL, NULL, now(), now()),

        (v_trainer2, v_tenant, v_branch, v_role_trainer,
         '33333333-3333-3333-3333-333333333333', 'trainer2.seed@gym.test', '+1-555-0003',
         'FF7BD97B1A7789DDD2775122FD6817F3173672DA9F802CEEC57F284325BF589F',
         'Jamie', 'Trainer', NULL, 1, DATE '1990-09-05', 0, now(), now(), now(), 0,
         NULL, NULL, 'en', NULL, 'Seed data trainer account.', NULL, NULL, now(), now()),

        (v_client1, v_tenant, v_branch, v_role_client,
         '44444444-4444-4444-4444-444444444444', 'client1.seed@gym.test', '+1-555-0004',
         'FF7BD97B1A7789DDD2775122FD6817F3173672DA9F802CEEC57F284325BF589F',
         'Sam', 'Client', NULL, 2, DATE '1995-01-15', 0, now(), now(), now(), 3,
         NULL, NULL, 'en', NULL, 'Seed data client — active membership.', NULL, NULL, now(), now()),

        (v_client2, v_tenant, v_branch, v_role_client,
         '55555555-5555-5555-5555-555555555555', 'client2.seed@gym.test', '+1-555-0005',
         'FF7BD97B1A7789DDD2775122FD6817F3173672DA9F802CEEC57F284325BF589F',
         'Riley', 'Client', NULL, 1, DATE '1998-11-30', 0, now(), now(), NULL, 0,
         NULL, NULL, 'en', NULL, 'Seed data client — trial membership.', NULL, NULL, now(), now()),

        (v_client3, v_tenant, v_branch, v_role_client,
         '66666666-6666-6666-6666-666666666666', 'client3.seed@gym.test', '+1-555-0006',
         'FF7BD97B1A7789DDD2775122FD6817F3173672DA9F802CEEC57F284325BF589F',
         'Morgan', 'Client', NULL, 0, DATE '1993-07-22', 0, now(), now(), now(), 1,
         NULL, NULL, 'en', NULL, 'Seed data client — corporate membership.', NULL, NULL, now(), now()),

        (v_staff1, v_tenant, v_branch, v_role_staff,
         '77777777-7777-7777-7777-777777777777', 'staff.seed@gym.test', '+1-555-0007',
         'FF7BD97B1A7789DDD2775122FD6817F3173672DA9F802CEEC57F284325BF589F',
         'Taylor', 'Staff', NULL, 3, DATE '1997-03-08', 0, now(), now(), NULL, 0,
         NULL, NULL, 'en', NULL, 'Seed data staff account — role has no backend/frontend features wired up yet.',
         NULL, NULL, now(), now());

    -- ── Per-user feature-module toggles (UserModuleAccesses) ────────────────
    -- Trainers and clients get every module enabled; staff gets none (there's
    -- nothing built for it — this row set intentionally stays empty).
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "UserModuleAccesses");
    INSERT INTO "UserModuleAccesses" ("Id","UserId","ModuleId","IsEnabled","GrantedByAdminId","GrantedAt")
    SELECT v_base + ROW_NUMBER() OVER (), u.user_id, m.module_id, TRUE, v_admin, now()
    FROM (VALUES (v_trainer1), (v_trainer2), (v_client1), (v_client2), (v_client3)) AS u(user_id)
    CROSS JOIN (VALUES (v_mod_workouts), (v_mod_exercises), (v_mod_plans), (v_mod_challenges),
                       (v_mod_live), (v_mod_stats), (v_mod_aicoach)) AS m(module_id);

    -- ── Role → resource permission grid (ModuleAccesses) ────────────────────
    -- This is the admin-configurable RBAC grid (RolesController / "manage roles"
    -- screen) — separate from the per-user toggles above.
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "ModuleAccesses");
    INSERT INTO "ModuleAccesses"
        ("Id","TenantId","RoleId","Module","CanView","CanCreate","CanEdit","CanDelete","CanExport","IsActive","CreatedAt","UpdatedAt")
    VALUES
        (v_base+1, v_tenant, v_role_admin,   'members', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, now(), now()),
        (v_base+2, v_tenant, v_role_admin,   'billing', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, now(), now()),
        (v_base+3, v_tenant, v_role_admin,   'reports', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, now(), now()),
        (v_base+4, v_tenant, v_role_trainer, 'members', TRUE, FALSE, TRUE, FALSE, FALSE, TRUE, now(), now()),
        (v_base+5, v_tenant, v_role_trainer, 'billing', TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, now(), now()),
        (v_base+6, v_tenant, v_role_trainer, 'reports', TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, now(), now());

    -- ── Trainer profiles + scheduling ───────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "TrainerProfiles");
    v_tp1 := v_base + 1;
    v_tp2 := v_base + 2;
    INSERT INTO "TrainerProfiles"
        ("Id","UserId","BranchId","TrainerCode","DisplayName","ProfileImage","Bio","ExperienceYears","Gender",
         "DateOfBirth","Phone","Email","Address","LanguagesKnown","Specializations","Certifications","Employment",
         "Salary","Allowances","Deductions","PaymentDetails","Availability","BookingSettings","CommissionSettings",
         "AttendanceSettings","Documents","EmergencyContact","SocialLinks","Rating","TotalSessions","IsAvailable",
         "Notes","CreatedAt","UpdatedAt")
    VALUES
        (v_tp1, v_trainer1, v_branch, 'TRN-001', 'Alex Trainer', NULL,
         'Strength & conditioning coach, 6 years experience.', 6, 'Male', DATE '1992-06-20',
         '+1-555-0002', 'trainer1.seed@gym.test', NULL,
         '["en"]'::jsonb, '["strength","conditioning"]'::jsonb, '["NASM-CPT"]'::jsonb, '{}'::jsonb,
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 4.8, 42, TRUE, NULL, now(), now()),

        (v_tp2, v_trainer2, v_branch, 'TRN-002', 'Jamie Trainer', NULL,
         'Yoga & mobility specialist, 4 years experience.', 4, 'Female', DATE '1990-09-05',
         '+1-555-0003', 'trainer2.seed@gym.test', NULL,
         '["en"]'::jsonb, '["yoga","mobility"]'::jsonb, '["RYT-200"]'::jsonb, '{}'::jsonb,
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 4.6, 27, TRUE, NULL, now(), now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "TrainerAvailabilitySlots");
    INSERT INTO "TrainerAvailabilitySlots" ("Id","TrainerId","DayOfWeek","StartTime","EndTime","IsActive")
    VALUES
        (v_base+1, v_tp1, 1, TIME '09:00', TIME '17:00', TRUE),
        (v_base+2, v_tp2, 2, TIME '10:00', TIME '18:00', TRUE);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "TrainerClientAssignments");
    INSERT INTO "TrainerClientAssignments" ("Id","TrainerId","ClientId","BranchId","Status","AssignedAt","EndedAt","Notes")
    VALUES
        (v_base+1, v_tp1, v_client1, v_branch, 0, now(), NULL, NULL),
        (v_base+2, v_tp1, v_client2, v_branch, 0, now(), NULL, NULL),
        (v_base+3, v_tp2, v_client3, v_branch, 0, now(), NULL, NULL);

    -- ── Membership plans, corporate account, subscriptions ──────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "MembershipPlans");
    v_plan_basic   := v_base + 1;
    v_plan_premium := v_base + 2;
    INSERT INTO "MembershipPlans"
        ("Id","TenantId","BranchId","Name","Description","BillingCycle","Price","Currency","TrialDays",
         "MaxMembers","Features","IsActive","SortOrder","CreatedAt","UpdatedAt")
    VALUES
        (v_plan_basic, v_tenant, v_branch, 'Basic Monthly', 'Gym floor access + group classes.', 2, 39.99, 'USD',
         0, NULL, '["gym_access","group_classes"]'::jsonb, TRUE, 1, now(), now()),
        (v_plan_premium, v_tenant, v_branch, 'Premium Yearly', 'Everything in Basic plus PT sessions and app coaching.',
         5, 499.00, 'USD', 14, NULL, '["gym_access","group_classes","pt_sessions","ai_coach"]'::jsonb, TRUE, 2, now(), now());

    v_corp1 := (SELECT COALESCE(MAX("Id"),0) FROM "CorporateAccounts") + 1;
    INSERT INTO "CorporateAccounts" ("Id","TenantId","Name","ContactEmail","ContactPhone","BillingInfo","MaxMembers","Status","CreatedAt","UpdatedAt")
    VALUES (v_corp1, v_tenant, 'Acme Corp', 'benefits@acme.test', '+1-555-0200', '{}'::jsonb, 50, 0, now(), now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "GymMemberships");
    v_gm1 := v_base + 1;
    v_gm2 := v_base + 2;
    v_gm3 := v_base + 3;
    INSERT INTO "GymMemberships"
        ("Id","TenantId","UserId","PlanId","BranchId","Status","StartsAt","EndsAt","PausedAt","CancelledAt",
         "AutoRenew","Source","CorporateId","Notes","CreatedAt","UpdatedAt")
    VALUES
        (v_gm1, v_tenant, v_client1, v_plan_basic,   v_branch, 0, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days', NULL, NULL, TRUE, 0, NULL, NULL, now(), now()),
        (v_gm2, v_tenant, v_client2, v_plan_premium, v_branch, 4, CURRENT_DATE - INTERVAL '3 days',  CURRENT_DATE + INTERVAL '11 days',  NULL, NULL, TRUE, 0, NULL, 'Trial period.', now(), now()),
        (v_gm3, v_tenant, v_client3, v_plan_basic,   v_branch, 0, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '275 days', NULL, NULL, TRUE, 3, v_corp1, 'Via Acme Corp benefits.', now(), now());

    -- ── Billing: invoices, gateway, payments, coupon ────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "Invoices");
    v_inv1 := v_base + 1;
    v_inv3 := v_base + 2;
    INSERT INTO "Invoices"
        ("Id","TenantId","UserId","MembershipId","InvoiceNo","Status","Subtotal","Tax","Discount","Total",
         "Currency","DueDate","PaidAt","Notes","CreatedAt","UpdatedAt")
    VALUES
        (v_inv1, v_tenant, v_client1, v_gm1, 'INV-SEED-0001', 2, 39.99, 3.60, 0, 43.59, 'USD',
         CURRENT_DATE - INTERVAL '30 days', now() - INTERVAL '29 days', NULL, now(), now()),
        (v_inv3, v_tenant, v_client3, v_gm3, 'INV-SEED-0002', 2, 39.99, 3.60, 4.00, 39.59, 'USD',
         CURRENT_DATE - INTERVAL '90 days', now() - INTERVAL '89 days', 'Corporate discount applied.', now(), now());

    v_gw1 := (SELECT COALESCE(MAX("Id"),0) FROM "PaymentGateways") + 1;
    INSERT INTO "PaymentGateways" ("Id","TenantId","Provider","ConfigEnc","IsActive","IsDefault")
    VALUES (v_gw1, v_tenant, 'stripe', '{"mode":"test"}'::jsonb, TRUE, TRUE);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "Payments");
    INSERT INTO "Payments" ("Id","TenantId","InvoiceId","GatewayId","Amount","Currency","Method","Status","GatewayRef","GatewayResponse","CreatedAt")
    VALUES
        (v_base+1, v_tenant, v_inv1, v_gw1, 43.59, 'USD', 0, 1, 'ch_seed_0001', '{}'::jsonb, now() - INTERVAL '29 days'),
        (v_base+2, v_tenant, v_inv3, v_gw1, 39.59, 'USD', 3, 1, 'ch_seed_0002', '{}'::jsonb, now() - INTERVAL '89 days');

    v_coupon1 := (SELECT COALESCE(MAX("Id"),0) FROM "Coupons") + 1;
    INSERT INTO "Coupons"
        ("Id","TenantId","Code","Description","Type","Value","Currency","MinOrder","MaxDiscount","MaxUses",
         "UsesCount","PerUserLimit","ValidFrom","ValidUntil","ApplicableTo","IsActive","CreatedAt","UpdatedAt")
    VALUES
        (v_coupon1, v_tenant, 'WELCOME10', '10% off first membership.', 0, 10, 'USD', 0, 20, 100,
         1, 1, now() - INTERVAL '60 days', now() + INTERVAL '300 days', '["membership_plan"]'::jsonb, TRUE, now(), now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "CouponRedemptions");
    INSERT INTO "CouponRedemptions" ("Id","CouponId","UserId","InvoiceId","TenantId","DiscountApplied","RedeemedAt")
    VALUES (v_base+1, v_coupon1, v_client2, NULL, v_tenant, 4.00, now() - INTERVAL '3 days');

    -- ── CRM: leads + activity timeline ──────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "Leads");
    v_lead1 := v_base + 1;
    v_lead2 := v_base + 2;
    v_lead3 := v_base + 3;
    INSERT INTO "Leads"
        ("Id","TenantId","BranchId","AssignedTo","AssignedUserId","FirstName","LastName","Email","Phone","Source",
         "Status","AiScore","ConversionProb","LastContactedAt","Notes","CustomFields","CreatedAt","UpdatedAt")
    VALUES
        (v_lead1, v_tenant, v_branch, NULL, NULL, 'Jordan', 'Prospect', 'jordan.prospect@example.test', '+1-555-0300',
         'website', 0, 40, 0.30, NULL, 'Filled out the homepage contact form.', NULL, now(), now()),
        (v_lead2, v_tenant, v_branch, v_trainer1, v_trainer1, 'Casey', 'Walkin', 'casey.walkin@example.test', '+1-555-0301',
         'walk-in', 1, 65, 0.55, now() - INTERVAL '2 days', 'Toured the facility, interested in PT packages.', NULL, now(), now()),
        (v_lead3, v_tenant, v_branch, NULL, NULL, 'Drew', 'Referral', 'drew.referral@example.test', '+1-555-0302',
         'referral', 5, 90, 0.95, now() - INTERVAL '10 days', 'Converted — now a paying member.', NULL, now(), now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "LeadActivities");
    INSERT INTO "LeadActivities" ("Id","LeadId","UserId","Type","Description","Outcome","CreatedAt")
    VALUES
        (v_base+1, v_lead2, v_trainer1, 4, 'Facility tour with Alex.', 'Interested, follow up next week.', now() - INTERVAL '2 days'),
        (v_base+2, v_lead2, v_trainer1, 0, 'Follow-up call about PT pricing.', 'Requested a quote.', now() - INTERVAL '1 days');

    -- ── Training library: muscles, equipment, exercises ─────────────────────
    INSERT INTO "MuscleGroups" ("Name") VALUES ('Chest')     RETURNING "Id" INTO v_muscle_chest;
    INSERT INTO "MuscleGroups" ("Name") VALUES ('Back')      RETURNING "Id" INTO v_muscle_back;
    INSERT INTO "MuscleGroups" ("Name") VALUES ('Legs')      RETURNING "Id" INTO v_muscle_legs;
    INSERT INTO "MuscleGroups" ("Name") VALUES ('Core')      RETURNING "Id" INTO v_muscle_core;

    INSERT INTO "Equipment" ("TenantId","Name","Category") VALUES (v_tenant, 'Barbell', 'Free Weights')   RETURNING "Id" INTO v_equip_barbell;
    INSERT INTO "Equipment" ("TenantId","Name","Category") VALUES (v_tenant, 'Dumbbell', 'Free Weights')  RETURNING "Id" INTO v_equip_dumbbell;
    INSERT INTO "Equipment" ("TenantId","Name","Category") VALUES (v_tenant, 'Bodyweight', 'None')        RETURNING "Id" INTO v_equip_bodyweight;

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "Exercises");
    v_ex_bench    := v_base + 1;
    v_ex_squat    := v_base + 2;
    v_ex_deadlift := v_base + 3;
    v_ex_plank    := v_base + 4;
    INSERT INTO "Exercises"
        ("Id","TenantId","CreatedBy","Name","Slug","Description","Instructions","Category","Difficulty",
         "VideoUrl","ThumbnailUrl","IsCustom","IsActive","Tags","Meta","CreatedAt","UpdatedAt")
    VALUES
        (v_ex_bench, v_tenant, v_admin, 'Barbell Bench Press', 'barbell-bench-press-seed',
         'Classic horizontal push for chest, shoulders, triceps.', 'Lie on bench, lower bar to chest, press up.',
         0, 1, NULL, NULL, FALSE, TRUE, '["chest","push"]'::jsonb, NULL, now(), now()),
        (v_ex_squat, v_tenant, v_admin, 'Back Squat', 'back-squat-seed',
         'Compound lower-body strength movement.', 'Bar on upper back, squat to depth, drive up.',
         0, 1, NULL, NULL, FALSE, TRUE, '["legs","compound"]'::jsonb, NULL, now(), now()),
        (v_ex_deadlift, v_tenant, v_admin, 'Deadlift', 'deadlift-seed',
         'Hip-hinge pull targeting posterior chain.', 'Grip bar, brace, stand up by extending hips and knees.',
         0, 2, NULL, NULL, FALSE, TRUE, '["back","compound"]'::jsonb, NULL, now(), now()),
        (v_ex_plank, v_tenant, v_admin, 'Plank', 'plank-seed',
         'Isometric core stability hold.', 'Hold forearm plank keeping hips level.',
         2, 0, NULL, NULL, FALSE, TRUE, '["core","isometric"]'::jsonb, NULL, now(), now());

    INSERT INTO "ExerciseMuscles" ("ExerciseId","MuscleId","Role") VALUES
        (v_ex_bench, v_muscle_chest, 0),
        (v_ex_squat, v_muscle_legs, 0),
        (v_ex_deadlift, v_muscle_back, 0),
        (v_ex_plank, v_muscle_core, 0);

    INSERT INTO "ExerciseEquipments" ("ExerciseId","EquipmentId") VALUES
        (v_ex_bench, v_equip_barbell),
        (v_ex_squat, v_equip_barbell),
        (v_ex_deadlift, v_equip_barbell),
        (v_ex_plank, v_equip_bodyweight);

    -- ── Workout templates + sections + exercises ────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutTemplates");
    v_wt1 := v_base + 1;
    v_wt2 := v_base + 2;
    INSERT INTO "WorkoutTemplates"
        ("Id","TenantId","CreatedBy","CreatorId","Name","Description","Category","Goal","Difficulty",
         "DurationMin","IsPublic","IsAiGenerated","BranchingRules","Tags","Version","CreatedAt","UpdatedAt")
    VALUES
        (v_wt1, v_tenant, v_trainer1, v_trainer1, 'Full Body Strength A', 'Full-body strength session for beginners.',
         'Strength', 1, 0, 45, TRUE, FALSE, NULL, '["strength","full-body"]'::jsonb, 1, now(), now()),
        (v_wt2, v_tenant, v_trainer2, v_trainer2, 'Core & Mobility', 'Core stability and mobility focused session.',
         'Mobility', 3, 0, 30, TRUE, FALSE, NULL, '["core","mobility"]'::jsonb, 1, now(), now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutSections");
    v_sec1 := v_base + 1;
    v_sec2 := v_base + 2;
    INSERT INTO "WorkoutSections" ("Id","TemplateId","Name","Type","SortOrder","RestSeconds","Rounds")
    VALUES
        (v_sec1, v_wt1, 'Main Lifts', 1, 1, 90, 1),
        (v_sec2, v_wt2, 'Core Circuit', 3, 1, 30, 3);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutExercises");
    INSERT INTO "WorkoutExercises"
        ("Id","SectionId","ExerciseId","SortOrder","Sets","Reps","DurationSeconds","RestSeconds","Tempo",
         "WeightSuggestion","Intensity","Notes","ConditionRules","AiSubstitutionOk")
    VALUES
        (v_base+1, v_sec1, v_ex_bench,    1, 4, '8',  NULL, 90, NULL, 'Moderate', 7, NULL, NULL, TRUE),
        (v_base+2, v_sec1, v_ex_squat,    2, 4, '8',  NULL, 90, NULL, 'Moderate', 7, NULL, NULL, TRUE),
        (v_base+3, v_sec1, v_ex_deadlift, 3, 3, '5',  NULL, 120, NULL, 'Heavy', 8, NULL, NULL, TRUE),
        (v_base+4, v_sec2, v_ex_plank,    1, 3, NULL, 45, 30, NULL, NULL, 5, 'Hold, don''t sag hips.', NULL, TRUE);

    -- ── Assignments + logged sessions ───────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutAssignments");
    v_wa1 := v_base + 1;
    v_wa2 := v_base + 2;
    INSERT INTO "WorkoutAssignments"
        ("Id","TenantId","TrainerId","ClientId","TemplateId","AssignedAt","DueDate","Status","Notes","CreatedAt")
    VALUES
        (v_wa1, v_tenant, v_tp1, v_client1, v_wt1, CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '2 days', 1, NULL, now() - INTERVAL '5 days'),
        (v_wa2, v_tenant, v_tp2, v_client3, v_wt2, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '5 days', 0, NULL, now() - INTERVAL '2 days');

    v_wl1 := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutLogs") + 1;
    INSERT INTO "WorkoutLogs"
        ("Id","ClientId","AssignmentId","TemplateId","BranchId","StartedAt","EndedAt","DurationMin","Calories",
         "Score","MoodBefore","MoodAfter","FatigueLevel","PostureData","Notes","CreatedAt")
    VALUES
        (v_wl1, v_client1, v_wa1, v_wt1, v_branch, now() - INTERVAL '4 days', now() - INTERVAL '4 days' + INTERVAL '45 minutes',
         45, 320, 88.5, 6, 8, 4, NULL, 'Felt strong today.', now() - INTERVAL '4 days');

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutLogSets");
    INSERT INTO "WorkoutLogSets" ("Id","LogId","ExerciseId","SetNo","Reps","WeightKg","DistanceM","DurationSec","Rpe","Notes")
    VALUES
        (v_base+1, v_wl1, v_ex_bench, 1, 8, 60.0, NULL, NULL, 7, NULL),
        (v_base+2, v_wl1, v_ex_squat, 1, 8, 80.0, NULL, NULL, 7, NULL);

    -- ── Multi-week workout plan ──────────────────────────────────────────────
    v_wp1 := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutPlans") + 1;
    INSERT INTO "WorkoutPlans"
        ("Id","TenantId","CreatedBy","CreatorId","Name","Description","DurationWeeks","Goal","Difficulty",
         "IsActive","ProgressionRules","Tags","CreatedAt","UpdatedAt")
    VALUES
        (v_wp1, v_tenant, v_trainer1, v_trainer1, '8-Week Strength Foundations',
         'Progressive full-body strength program for new members.', 8, 1, 0, TRUE, NULL,
         '["strength","beginner"]'::jsonb, now(), now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutPlanWeeks");
    v_wpw1 := v_base + 1;
    v_wpw2 := v_base + 2;
    INSERT INTO "WorkoutPlanWeeks" ("Id","PlanId","WeekNumber","Notes")
    VALUES
        (v_wpw1, v_wp1, 1, 'Foundation week — focus on form.'),
        (v_wpw2, v_wp1, 2, 'Add load, same rep scheme.');

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutPlanDays");
    INSERT INTO "WorkoutPlanDays" ("Id","WeekId","TemplateId","DayNumber","IsRestDay")
    VALUES
        (v_base+1, v_wpw1, v_wt1, 1, FALSE),
        (v_base+2, v_wpw1, NULL, 2, TRUE),
        (v_base+3, v_wpw2, v_wt1, 1, FALSE),
        (v_base+4, v_wpw2, NULL, 2, TRUE);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "WorkoutPlanAssignments");
    INSERT INTO "WorkoutPlanAssignments" ("Id","PlanId","ClientId","TrainerId","StartDate","Status","CreatedAt")
    VALUES (v_base+1, v_wp1, v_client1, v_tp1, CURRENT_DATE - INTERVAL '5 days', 1, now() - INTERVAL '5 days');

    -- ── Personal-training session types + bookings ──────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "PtSessionTypes");
    v_pst1 := v_base + 1;
    v_pst2 := v_base + 2;
    INSERT INTO "PtSessionTypes" ("Id","TenantId","TrainerId","Name","DurationMin","Price","Currency","Description","IsActive")
    VALUES
        (v_pst1, v_tenant, v_tp1, '1:1 Strength Session', 60, 75.00, 'USD', 'One-on-one strength coaching.', TRUE),
        (v_pst2, v_tenant, v_tp2, '1:1 Mobility Session', 45, 60.00, 'USD', 'One-on-one mobility coaching.', TRUE);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "PtSessions");
    INSERT INTO "PtSessions"
        ("Id","TenantId","BranchId","SessionTypeId","TrainerId","ClientId","StartsAt","EndsAt","Status",
         "Price","Notes","TrainerNotes","Rating","CreatedAt","UpdatedAt")
    VALUES
        (v_base+1, v_tenant, v_branch, v_pst1, v_tp1, v_client1, now() + INTERVAL '2 days', now() + INTERVAL '2 days' + INTERVAL '1 hour',
         0, 75.00, NULL, NULL, NULL, now(), now()),
        (v_base+2, v_tenant, v_branch, v_pst2, v_tp2, v_client3, now() - INTERVAL '3 days', now() - INTERVAL '3 days' + INTERVAL '45 minutes',
         3, 60.00, NULL, 'Great progress on hip mobility.', 5, now() - INTERVAL '3 days', now() - INTERVAL '3 days');

    -- ── Group classes ────────────────────────────────────────────────────────
    v_ct1 := (SELECT COALESCE(MAX("Id"),0) FROM "ClassTypes") + 1;
    INSERT INTO "ClassTypes" ("Id","TenantId","Name","Description","DurationMin","MaxCapacity","Color","IconUrl","IsActive")
    VALUES (v_ct1, v_tenant, 'Yoga Flow', 'All-levels vinyasa flow class.', 60, 20, '#7ED321', NULL, TRUE);

    v_gc1 := (SELECT COALESCE(MAX("Id"),0) FROM "GymClasses") + 1;
    INSERT INTO "GymClasses"
        ("Id","TenantId","BranchId","ClassTypeId","TrainerId","Title","StartsAt","EndsAt","MaxCapacity",
         "EnrolledCount","WaitlistCount","Status","RecurrenceRule","RecurrenceId","Notes")
    VALUES
        (v_gc1, v_tenant, v_branch, v_ct1, v_tp2, 'Morning Yoga Flow', now() + INTERVAL '1 days', now() + INTERVAL '1 days' + INTERVAL '1 hour',
         20, 1, 0, 0, NULL, NULL, NULL);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "ClassBookings");
    INSERT INTO "ClassBookings" ("Id","ClassId","ClientId","Status","BookedAt","CancelledAt")
    VALUES (v_base+1, v_gc1, v_client2, 0, now() - INTERVAL '1 days', NULL);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "Attendances");
    INSERT INTO "Attendances" ("Id","TenantId","BranchId","UserId","CheckInAt","CheckOutAt","Method","GateDevice")
    VALUES
        (v_base+1, v_tenant, v_branch, v_client1, now() - INTERVAL '4 days' + INTERVAL '8 hours', now() - INTERVAL '4 days' + INTERVAL '9 hours', 0, 'front-gate'),
        (v_base+2, v_tenant, v_branch, v_client3, now() - INTERVAL '3 days' + INTERVAL '17 hours', now() - INTERVAL '3 days' + INTERVAL '18 hours', 2, 'front-gate');

    -- ── Client health profile & metrics ──────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "ClientProfiles");
    INSERT INTO "ClientProfiles"
        ("Id","UserId","HeightCm","WeightKg","BodyFatPct","MuscleMassKg","FitnessLevel","HealthConditions",
         "Allergies","FitnessGoals","EmergencyContact","CreatedAt","UpdatedAt")
    VALUES
        (v_base+1, v_client1, 178.0, 82.5, 18.2, 62.0, 1, NULL, NULL, '["build_muscle"]'::jsonb, NULL, now(), now()),
        (v_base+2, v_client2, 165.0, 60.0, 24.0, 40.0, 0, NULL, NULL, '["lose_weight"]'::jsonb, NULL, now(), now()),
        (v_base+3, v_client3, 172.0, 70.0, 20.5, 50.0, 2, NULL, NULL, '["general_fitness"]'::jsonb, NULL, now(), now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "HealthMetrics");
    INSERT INTO "HealthMetrics"
        ("Id","ClientId","MetricDate","WeightKg","BodyFatPct","Bmi","RestingHr","BloodPressureSys","BloodPressureDia",
         "SleepHours","StressLevel","HydrationMl","Steps","CaloriesBurned","RecoveryScore","Mood","Notes","Source","CreatedAt")
    VALUES
        (v_base+1, v_client1, CURRENT_DATE, 82.3, 18.0, 26.0, 58, 118, 76, 7.5, 3, 2200, 8500, 2400, 82, 8, NULL, 0, now()),
        (v_base+2, v_client2, CURRENT_DATE, 59.8, 23.8, 22.0, 65, 110, 70, 6.0, 5, 1800, 5200, 1900, 70, 6, NULL, 0, now()),
        (v_base+3, v_client3, CURRENT_DATE, 69.7, 20.2, 23.6, 60, 115, 74, 8.0, 2, 2500, 9200, 2600, 88, 9, NULL, 3, now());

    -- ── Challenges / gamification ────────────────────────────────────────────
    v_chal1 := (SELECT COALESCE(MAX("Id"),0) FROM "Challenges") + 1;
    INSERT INTO "Challenges" ("Id","TenantId","CreatedBy","Title","Description","Type","Metric","TargetValue",
        "StartsAt","EndsAt","Status","IsAutomated","Prizes")
    VALUES
        (v_chal1, v_tenant, v_admin, 'January Step Challenge', 'Most steps logged in 30 days wins.', 0, 'steps',
         300000, now() - INTERVAL '5 days', now() + INTERVAL '25 days', 1, TRUE, '["1 month free membership"]'::jsonb);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "ChallengeParticipants");
    INSERT INTO "ChallengeParticipants" ("Id","ChallengeId","UserId","JoinedAt","Progress","Rank")
    VALUES
        (v_base+1, v_chal1, v_client1, now() - INTERVAL '5 days', 42500, 1),
        (v_base+2, v_chal1, v_client3, now() - INTERVAL '4 days', 36800, 2);

    v_ach1 := (SELECT COALESCE(MAX("Id"),0) FROM "Achievements") + 1;
    INSERT INTO "Achievements" ("Id","TenantId","Name","Description","IconUrl","Type","Criteria","Points","IsActive")
    VALUES (v_ach1, v_tenant, 'First Workout', 'Complete your first logged workout.', NULL, 1, '{"workouts":1}'::jsonb, 10, TRUE);

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "UserAchievements");
    INSERT INTO "UserAchievements" ("Id","UserId","AchievementId","EarnedAt")
    VALUES (v_base+1, v_client1, v_ach1, now() - INTERVAL '4 days');

    -- ── Facility access / biometric entry log ───────────────────────────────
    v_dev1 := (SELECT COALESCE(MAX("Id"),0) FROM "AccessDevices") + 1;
    INSERT INTO "AccessDevices" ("Id","BranchId","Name","Type","Location","DeviceUid","IsOnline","LastPing")
    VALUES (v_dev1, v_branch, 'Front Gate Face Scanner', 1, 'Main Entrance', 'DEV-SEED-0001', TRUE, now());

    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "AccessEvents");
    INSERT INTO "AccessEvents" ("Id","DeviceId","UserId","EventType","Method","Confidence","CreatedAt")
    VALUES
        (v_base+1, v_dev1, v_client1, 0, 1, 0.98, now() - INTERVAL '4 days' + INTERVAL '8 hours'),
        (v_base+2, v_dev1, v_client3, 0, 2, 0.95, now() - INTERVAL '3 days' + INTERVAL '17 hours');

    -- ── Onboarding checklist ──────────────────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "OnboardingSteps");
    INSERT INTO "OnboardingSteps" ("Id","TenantId","StepKey","Label","IsRequired","IsDone","DoneAt","SortOrder")
    VALUES
        (v_base+1, v_tenant, 'branch_setup',   'Set up your first branch', TRUE, TRUE,  now() - INTERVAL '90 days', 1),
        (v_base+2, v_tenant, 'membership_plans','Create membership plans',  TRUE, TRUE,  now() - INTERVAL '89 days', 2),
        (v_base+3, v_tenant, 'invite_trainers', 'Invite your trainers',     TRUE, TRUE,  now() - INTERVAL '85 days', 3),
        (v_base+4, v_tenant, 'connect_sso',     'Connect an SSO provider',  FALSE, FALSE, NULL, 4);

    -- ── Pricing rule ──────────────────────────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "PricingRules");
    INSERT INTO "PricingRules" ("Id","TenantId","Name","AppliesTo","EntityId","RuleType","Conditions",
        "PriceModifier","ModifierType","Priority","IsActive","ValidFrom","ValidUntil","CreatedAt")
    VALUES
        (v_base+1, v_tenant, 'Corporate Discount', 0, v_plan_basic, 2,
         '{"segment":"corporate"}'::jsonb, 10, 0, 1, TRUE, now() - INTERVAL '90 days', NULL, now());

    -- ── SSO provider config ───────────────────────────────────────────────────
    v_base := (SELECT COALESCE(MAX("Id"),0) FROM "SsoProviders");
    INSERT INTO "SsoProviders" ("Id","TenantId","Provider","ClientId","ClientSecretEnc","Metadata","IsActive")
    VALUES (v_base+1, v_tenant, 'google', 'seed-demo-client-id.apps.googleusercontent.com', 'ENC(seed-demo-secret)', '{}'::jsonb, TRUE);

    -- ── AI Coach settings (stored as tenant settings JSON) ──────────────────
    IF NOT EXISTS (SELECT 1 FROM "TenantSettings" WHERE "TenantId" = v_tenant AND "Key" = 'ai-coach-tips') THEN
        v_base := (SELECT COALESCE(MAX("Id"),0) FROM "TenantSettings");
        INSERT INTO "TenantSettings" ("Id","TenantId","Key","Value","CreatedAt","UpdatedAt")
        VALUES (v_base+1, v_tenant, 'ai-coach-tips',
            '{"enabled":true,"tone":"encouraging","dailyTipLimit":3}'::jsonb, now(), now());
    END IF;

    RAISE NOTICE 'Demo seed applied: branch=%, admin=%, trainers=[%,%], clients=[%,%,%], staff=%',
        v_branch, v_admin, v_trainer1, v_trainer2, v_client1, v_client2, v_client3, v_staff1;
END;
$$ LANGUAGE plpgsql;
