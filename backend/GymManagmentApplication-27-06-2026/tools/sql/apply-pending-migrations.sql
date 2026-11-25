START TRANSACTION;
ALTER TABLE "CommunicationLogs" DROP CONSTRAINT "FK_CommunicationLogs_Campaigns_CampaignId";

DROP TABLE "AiChatMessages";

DROP TABLE "AnalyticsDailys";

DROP TABLE "ApiKeys";

DROP TABLE "AutomationLogs";

DROP TABLE "Campaigns";

DROP TABLE "ClientGoals";

DROP TABLE "CustomFieldDefinitions";

DROP TABLE "CustomPages";

DROP TABLE "EquipmentBookings";

DROP TABLE "EquipmentMaintenanceLogs";

DROP TABLE "ExportJobs";

DROP TABLE "FeatureFlags";

DROP TABLE "FeedbackResponses";

DROP TABLE "InjuryRecords";

DROP TABLE "LockerAssignments";

DROP TABLE "MlPredictions";

DROP TABLE "NavigationMenus";

DROP TABLE "NotificationTemplates";

DROP TABLE "NutritionLogs";

DROP TABLE "PayrollConfigs";

DROP TABLE "PayrollSlips";

DROP TABLE "PoseLogs";

DROP TABLE "Referrals";

DROP TABLE "ScheduledTasks";

DROP TABLE "SearchIndexCaches";

DROP TABLE "SupportTicketReplies";

DROP TABLE "TenantFeatureOverrides";

DROP TABLE "TenantPlugins";

DROP TABLE "TrainerAnalyticsDailys";

DROP TABLE "UiThemes";

DROP TABLE "UserAchievements";

DROP TABLE "VirtualSessions";

DROP TABLE "WearableDevices";

DROP TABLE "WebhookDeliveries";

DROP TABLE "WorkoutLogSets";

DROP TABLE "WorkoutProgressions";

DROP TABLE "AiChatSessions";

DROP TABLE "AutomationRules";

DROP TABLE "FacilityEquipments";

DROP TABLE "FeedbackSurveys";

DROP TABLE "Lockers";

DROP TABLE "DietPlans";

DROP TABLE "FoodItems";

DROP TABLE "PayrollPeriods";

DROP TABLE "ReferralPrograms";

DROP TABLE "SupportTickets";

DROP TABLE "Plugins";

DROP TABLE "Achievements";

DROP TABLE "Webhooks";

DROP INDEX "IX_Notifications_UserId";

DROP INDEX "IX_Invoices_UserId";

DROP INDEX "IX_GymMemberships_TenantId";

DROP INDEX "IX_GymClasses_TenantId";

DROP INDEX "IX_CommunicationLogs_CampaignId";

DROP INDEX "IX_CommunicationLogs_TenantId";

ALTER TABLE "Payments" ADD "IdempotencyKey" character varying(100);

ALTER TABLE "CommunicationLogs" ADD "Attempts" integer NOT NULL DEFAULT 0;

CREATE TABLE "TenantCounters" (
    "TenantId" numeric(20,0) NOT NULL,
    "Key" character varying(64) NOT NULL,
    "Value" bigint NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TenantCounters" PRIMARY KEY ("TenantId", "Key")
);

CREATE TABLE "WorkoutBookmarks" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "WorkoutTemplateId" numeric(20,0) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_WorkoutBookmarks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WorkoutBookmarks_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WorkoutBookmarks_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_WorkoutBookmarks_WorkoutTemplates_WorkoutTemplateId" FOREIGN KEY ("WorkoutTemplateId") REFERENCES "WorkoutTemplates" ("Id") ON DELETE CASCADE
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payments" WHERE "GatewayRef" IS NOT NULL
             GROUP BY "TenantId", "GatewayRef" HAVING COUNT(*) > 1) THEN
    RAISE NOTICE 'Duplicate Payments.GatewayRef rows found; creating a non-unique index.';
    CREATE INDEX "IX_Payments_TenantId_GatewayRef" ON "Payments" ("TenantId", "GatewayRef") WHERE "GatewayRef" IS NOT NULL;
  ELSE
    CREATE UNIQUE INDEX "IX_Payments_TenantId_GatewayRef" ON "Payments" ("TenantId", "GatewayRef") WHERE "GatewayRef" IS NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX "IX_Payments_TenantId_IdempotencyKey" ON "Payments" ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

CREATE INDEX "IX_Notifications_UserId_ReadAt" ON "Notifications" ("UserId", "ReadAt");

CREATE INDEX "IX_Invoices_UserId_Status" ON "Invoices" ("UserId", "Status");

CREATE INDEX "IX_GymMemberships_TenantId_Status_EndsAt" ON "GymMemberships" ("TenantId", "Status", "EndsAt");

CREATE INDEX "IX_GymClasses_TenantId_StartsAt" ON "GymClasses" ("TenantId", "StartsAt");

CREATE INDEX "IX_CommunicationLogs_Status_Channel_CreatedAt" ON "CommunicationLogs" ("Status", "Channel", "CreatedAt");

CREATE INDEX "IX_CommunicationLogs_TenantId_ProviderRef" ON "CommunicationLogs" ("TenantId", "ProviderRef");

CREATE INDEX "IX_WorkoutBookmarks_TenantId" ON "WorkoutBookmarks" ("TenantId");

CREATE UNIQUE INDEX "IX_WorkoutBookmarks_UserId_WorkoutTemplateId" ON "WorkoutBookmarks" ("UserId", "WorkoutTemplateId");

CREATE INDEX "IX_WorkoutBookmarks_WorkoutTemplateId" ON "WorkoutBookmarks" ("WorkoutTemplateId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261104115221_ArchitectureAudit', '9.0.0');

CREATE SEQUENCE IF NOT EXISTS "AccessDevices_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"AccessDevices_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "AccessDevices")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "AccessDevices_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "AccessEvents_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"AccessEvents_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "AccessEvents")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "AccessEvents_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "AssessmentTemplates_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"AssessmentTemplates_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "AssessmentTemplates")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "AssessmentTemplates_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Attendances_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Attendances_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Attendances")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Attendances_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "AuditLogs_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"AuditLogs_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "AuditLogs")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "AuditLogs_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "AuthCodes_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"AuthCodes_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "AuthCodes")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "AuthCodes_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Branches_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Branches_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Branches")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Branches_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ChallengeParticipants_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ChallengeParticipants_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ChallengeParticipants")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ChallengeParticipants_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Challenges_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Challenges_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Challenges")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Challenges_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ClassBookings_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ClassBookings_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ClassBookings")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ClassBookings_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ClassTypes_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ClassTypes_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ClassTypes")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ClassTypes_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ClientAssessments_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ClientAssessments_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ClientAssessments")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ClientAssessments_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ClientProfiles_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ClientProfiles_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ClientProfiles")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ClientProfiles_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "CommunicationLogs_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"CommunicationLogs_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "CommunicationLogs")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "CommunicationLogs_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "CorporateAccounts_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"CorporateAccounts_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "CorporateAccounts")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "CorporateAccounts_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "CouponRedemptions_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"CouponRedemptions_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "CouponRedemptions")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "CouponRedemptions_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Coupons_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Coupons_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Coupons")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Coupons_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Exercises_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Exercises_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Exercises")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Exercises_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "GymClasses_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"GymClasses_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "GymClasses")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "GymClasses_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "GymMemberships_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"GymMemberships_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "GymMemberships")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "GymMemberships_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "HabitLogs_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"HabitLogs_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "HabitLogs")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "HabitLogs_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "HabitTrackers_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"HabitTrackers_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "HabitTrackers")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "HabitTrackers_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "HealthMetrics_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"HealthMetrics_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "HealthMetrics")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "HealthMetrics_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Invoices_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Invoices_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Invoices")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Invoices_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "LeadActivities_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"LeadActivities_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "LeadActivities")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "LeadActivities_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Leads_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Leads_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Leads")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Leads_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "MediaLibraries_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"MediaLibraries_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "MediaLibraries")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "MediaLibraries_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "MembershipPlans_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"MembershipPlans_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "MembershipPlans")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "MembershipPlans_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ModuleAccesses_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ModuleAccesses_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ModuleAccesses")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ModuleAccesses_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Modules_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Modules_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Modules")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Modules_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Notifications_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Notifications_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Notifications")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Notifications_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "OnboardingSteps_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"OnboardingSteps_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "OnboardingSteps")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "OnboardingSteps_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "PaymentGateways_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"PaymentGateways_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "PaymentGateways")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "PaymentGateways_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Payments_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Payments_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Payments")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Payments_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Permissions_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Permissions_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Permissions")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Permissions_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "PricingRules_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"PricingRules_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "PricingRules")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "PricingRules_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "PtSessions_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"PtSessions_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "PtSessions")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "PtSessions_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "PtSessionTypes_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"PtSessionTypes_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "PtSessionTypes")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "PtSessionTypes_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Ratings_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Ratings_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Ratings")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Ratings_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "RoleModuleGrants_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"RoleModuleGrants_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "RoleModuleGrants")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "RoleModuleGrants_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Roles_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Roles_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Roles")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Roles_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopAddresses_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopAddresses_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopAddresses")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopAddresses_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopCartItems_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopCartItems_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopCartItems")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopCartItems_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopCarts_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopCarts_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopCarts")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopCarts_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopCategories_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopCategories_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopCategories")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopCategories_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopInventories_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopInventories_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopInventories")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopInventories_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopOrderItems_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopOrderItems_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopOrderItems")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopOrderItems_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopOrders_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopOrders_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopOrders")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopOrders_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopPayments_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopPayments_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopPayments")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopPayments_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopProductImages_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopProductImages_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopProductImages")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopProductImages_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopProducts_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopProducts_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopProducts")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopProducts_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopReviews_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopReviews_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopReviews")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopReviews_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopVariants_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopVariants_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopVariants")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopVariants_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopWishlistItems_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopWishlistItems_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopWishlistItems")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopWishlistItems_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "ShopWishlists_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"ShopWishlists_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "ShopWishlists")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "ShopWishlists_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "SocialPostComments_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"SocialPostComments_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("CommentId"), 0) + 1 FROM "SocialPostComments")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "SocialPostComments_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "SocialPostImages_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"SocialPostImages_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("ImageId"), 0) + 1 FROM "SocialPostImages")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "SocialPostImages_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "SocialPostLikes_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"SocialPostLikes_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("LikeId"), 0) + 1 FROM "SocialPostLikes")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "SocialPostLikes_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "SocialPosts_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"SocialPosts_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("PostId"), 0) + 1 FROM "SocialPosts")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "SocialPosts_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "SsoProviders_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"SsoProviders_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "SsoProviders")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "SsoProviders_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Tags_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Tags_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Tags")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Tags_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Tenants_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Tenants_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Tenants")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Tenants_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "TenantSettings_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"TenantSettings_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "TenantSettings")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "TenantSettings_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "TrainerAvailabilitySlots_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"TrainerAvailabilitySlots_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "TrainerAvailabilitySlots")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "TrainerAvailabilitySlots_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "TrainerClientAssignments_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"TrainerClientAssignments_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "TrainerClientAssignments")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "TrainerClientAssignments_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "TrainerProfiles_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"TrainerProfiles_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "TrainerProfiles")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "TrainerProfiles_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "TrainerTimeOffs_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"TrainerTimeOffs_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "TrainerTimeOffs")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "TrainerTimeOffs_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "TransformationJournals_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"TransformationJournals_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "TransformationJournals")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "TransformationJournals_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "UserModuleAccesses_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"UserModuleAccesses_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "UserModuleAccesses")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "UserModuleAccesses_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "UserRoles_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"UserRoles_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "UserRoles")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "UserRoles_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "Users_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"Users_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "Users")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "Users_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "UserSessions_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"UserSessions_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "UserSessions")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "UserSessions_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutAssignments_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutAssignments_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutAssignments")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutAssignments_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutAutomationLogs_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutAutomationLogs_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutAutomationLogs")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutAutomationLogs_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutAutomationRules_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutAutomationRules_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutAutomationRules")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutAutomationRules_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutBookmarks_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutBookmarks_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutBookmarks")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutBookmarks_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutExercises_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutExercises_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutExercises")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutExercises_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutLogs_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutLogs_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutLogs")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutLogs_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutPlanAssignments_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutPlanAssignments_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutPlanAssignments")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutPlanAssignments_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutPlanBranches_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutPlanBranches_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutPlanBranches")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutPlanBranches_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutPlanDays_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutPlanDays_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutPlanDays")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutPlanDays_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutPlans_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutPlans_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutPlans")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutPlans_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutPlanWeeks_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutPlanWeeks_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutPlanWeeks")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutPlanWeeks_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutSections_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutSections_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutSections")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutSections_Id_hilo_seq")),
    false);

CREATE SEQUENCE IF NOT EXISTS "WorkoutTemplates_Id_hilo_seq" AS bigint START WITH 1 INCREMENT BY 10 NO CYCLE;

SELECT setval('"WorkoutTemplates_Id_hilo_seq"', GREATEST(
    (SELECT COALESCE(MAX("Id"), 0) + 1 FROM "WorkoutTemplates")::bigint,
    (SELECT CASE WHEN is_called THEN last_value + 10 ELSE last_value END FROM "WorkoutTemplates_Id_hilo_seq")),
    false);

DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT n.nspname, c.relname, a.attname
        FROM pg_attrdef d
        JOIN pg_class c ON c.oid = d.adrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
        WHERE pg_get_expr(d.adbin, d.adrelid) LIKE '%global_id_seq%'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', r.nspname, r.relname, r.attname);
    END LOOP;
END $$;

DROP SEQUENCE IF EXISTS global_id_seq;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261105092918_IdSequences', '9.0.0');

CREATE SEQUENCE "AccountDeletionRequests_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "Announcements_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "BranchHoursExceptions_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "BranchOpeningIntervals_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "BranchProfiles_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "ConsentRecords_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "DataExportRequests_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "HealthScreenings_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "MemberEmergencyContacts_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "MembershipRequests_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "NotificationPreferences_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "PushDevices_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "SafetyGateOverrides_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "ServiceStatuses_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "TrustedDevices_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "TwoFactorChallenges_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "TwoFactorRecoveryCodes_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "UserTwoFactors_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "WaitlistOffers_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "WaiverDocuments_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "WaiverSignatures_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "WaiverVersions_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

ALTER TABLE "MembershipPlans" ADD "AccessHours" character varying(120);

ALTER TABLE "MembershipPlans" ADD "ClassCredits" integer;

ALTER TABLE "MembershipPlans" ADD "IsPopular" boolean NOT NULL DEFAULT FALSE;

ALTER TABLE "MembershipPlans" ADD "IsPublic" boolean NOT NULL DEFAULT TRUE;

ALTER TABLE "MembershipPlans" ADD "JoiningFee" numeric(18,2) NOT NULL DEFAULT 0.0;

ALTER TABLE "MembershipPlans" ADD "PtSessions" integer;

ALTER TABLE "CommunicationLogs" ADD "Meta" jsonb;

ALTER TABLE "CommunicationLogs" ADD "NotBefore" timestamp with time zone;

CREATE TABLE "AccountDeletionRequests" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "Source" character varying(20) NOT NULL,
    "RequestedByUserId" numeric(20,0) NOT NULL,
    "RequestedAt" timestamp with time zone NOT NULL,
    "ScheduledFor" timestamp with time zone NOT NULL,
    "CancelledAt" timestamp with time zone,
    "CancelledByUserId" numeric(20,0),
    "CompletedAt" timestamp with time zone,
    "ProcessedByUserId" numeric(20,0),
    "BlockedReason" character varying(500),
    "Reason" character varying(500),
    "Summary" jsonb,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_AccountDeletionRequests" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_AccountDeletionRequests_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_AccountDeletionRequests_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Announcements" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "Title" character varying(150) NOT NULL,
    "Body" character varying(10000) NOT NULL,
    "ImageUrl" character varying(1000),
    "CtaLabel" character varying(40),
    "CtaRoute" character varying(200),
    "Audience" character varying(20) NOT NULL,
    "AudienceIds" character varying(2000),
    "IsPinned" boolean NOT NULL,
    "IsUrgent" boolean NOT NULL,
    "Status" character varying(20) NOT NULL,
    "PublishAt" timestamp with time zone,
    "PublishedAt" timestamp with time zone,
    "ExpiresAt" timestamp with time zone,
    "DeliveryLockedUntil" timestamp with time zone,
    "RecipientCount" integer NOT NULL,
    "CreatedByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Announcements" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Announcements_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "BranchHoursExceptions" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0) NOT NULL,
    "Date" date NOT NULL,
    "IsClosed" boolean NOT NULL,
    "Intervals" character varying(200),
    "Note" character varying(200),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_BranchHoursExceptions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BranchHoursExceptions_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_BranchHoursExceptions_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "BranchOpeningIntervals" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0) NOT NULL,
    "DayOfWeek" integer NOT NULL,
    "OpensAt" time without time zone NOT NULL,
    "ClosesAt" time without time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_BranchOpeningIntervals" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BranchOpeningIntervals_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_BranchOpeningIntervals_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "BranchProfiles" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0) NOT NULL,
    "Amenities" character varying(5000),
    "Accessibility" character varying(5000),
    "UpdatedByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_BranchProfiles" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BranchProfiles_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_BranchProfiles_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ConsentRecords" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "Type" character varying(40) NOT NULL,
    "Granted" boolean NOT NULL,
    "Version" character varying(40) NOT NULL,
    "At" timestamp with time zone NOT NULL,
    "Source" character varying(40) NOT NULL,
    "Ip" character varying(64),
    "RecordedByUserId" numeric(20,0),
    CONSTRAINT "PK_ConsentRecords" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ConsentRecords_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ConsentRecords_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "DataExportRequests" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "RequestedByUserId" numeric(20,0) NOT NULL,
    "RequestedAt" timestamp with time zone NOT NULL,
    "StartedAt" timestamp with time zone,
    "ReadyAt" timestamp with time zone,
    "ExpiresAt" timestamp with time zone,
    "FileUrl" character varying(1000),
    "SizeBytes" bigint,
    "Attempts" integer NOT NULL,
    "Error" character varying(500),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_DataExportRequests" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_DataExportRequests_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_DataExportRequests_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "HealthScreenings" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "FormVersion" character varying(40) NOT NULL,
    "Answers" jsonb NOT NULL,
    "YesCount" integer NOT NULL,
    "Conditions" character varying(2000),
    "Medications" character varying(2000),
    "Injuries" character varying(2000),
    "Pregnancy" character varying(500),
    "NeedsClearance" boolean NOT NULL,
    "SubmittedAt" timestamp with time zone NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "ClearedAt" timestamp with time zone,
    "ClearedByUserId" numeric(20,0),
    "ClearanceNote" character varying(1000),
    CONSTRAINT "PK_HealthScreenings" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_HealthScreenings_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_HealthScreenings_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "MemberEmergencyContacts" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "Name" character varying(150) NOT NULL,
    "Relationship" character varying(60),
    "Phone" character varying(30) NOT NULL,
    "UpdatedByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_MemberEmergencyContacts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_MemberEmergencyContacts_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_MemberEmergencyContacts_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "MembershipRequests" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "MembershipId" numeric(20,0) NOT NULL,
    "Type" character varying(20) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "ReasonCode" character varying(40),
    "Reason" character varying(1000),
    "RequestedAt" timestamp with time zone NOT NULL,
    "EffectiveFrom" date,
    "EffectiveTo" date,
    "NewPlanId" numeric(20,0),
    "Fee" numeric(18,2) NOT NULL,
    "InvoiceId" numeric(20,0),
    "AutoApproved" boolean NOT NULL,
    "DecidedBy" numeric(20,0),
    "DecidedAt" timestamp with time zone,
    "DecisionNote" character varying(1000),
    "AppliedAt" timestamp with time zone,
    "CompletedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_MembershipRequests" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_MembershipRequests_GymMemberships_MembershipId" FOREIGN KEY ("MembershipId") REFERENCES "GymMemberships" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_MembershipRequests_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_MembershipRequests_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "NotificationPreferences" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "Channels" jsonb,
    "QuietHoursEnabled" boolean NOT NULL,
    "QuietStart" time without time zone NOT NULL,
    "QuietEnd" time without time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_NotificationPreferences" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_NotificationPreferences_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_NotificationPreferences_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "PushDevices" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "Token" character varying(255) NOT NULL,
    "Platform" character varying(16) NOT NULL,
    "DeviceName" character varying(120),
    "CreatedAt" timestamp with time zone NOT NULL,
    "LastSeenAt" timestamp with time zone NOT NULL,
    "DisabledAt" timestamp with time zone,
    "DisabledReason" character varying(64),
    CONSTRAINT "PK_PushDevices" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PushDevices_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PushDevices_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "SafetyGateOverrides" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "OverriddenByUserId" numeric(20,0) NOT NULL,
    "Context" character varying(40) NOT NULL,
    "Missing" character varying(200) NOT NULL,
    "Reason" character varying(500),
    "AttendanceId" numeric(20,0),
    "At" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SafetyGateOverrides" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SafetyGateOverrides_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_SafetyGateOverrides_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ServiceStatuses" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0),
    "Area" character varying(80),
    "Status" character varying(20) NOT NULL,
    "Severity" character varying(20) NOT NULL,
    "Message" character varying(500) NOT NULL,
    "StartsAt" timestamp with time zone NOT NULL,
    "EndsAt" timestamp with time zone,
    "CreatedByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_ServiceStatuses" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ServiceStatuses_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ServiceStatuses_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "TrustedDevices" (
    "Id" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "TokenHash" character varying(128) NOT NULL,
    "UserAgent" character varying(255),
    "IpAddress" character varying(64),
    "ExpiresAt" timestamp with time zone NOT NULL,
    "LastUsedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TrustedDevices" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TrustedDevices_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "TwoFactorChallenges" (
    "Id" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "TokenHash" character varying(128) NOT NULL,
    "Attempts" integer NOT NULL,
    "EmailSends" integer NOT NULL,
    "IpAddress" character varying(64),
    "ExpiresAt" timestamp with time zone NOT NULL,
    "ConsumedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TwoFactorChallenges" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TwoFactorChallenges_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "TwoFactorRecoveryCodes" (
    "Id" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "CodeHash" character varying(128) NOT NULL,
    "UsedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TwoFactorRecoveryCodes" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_TwoFactorRecoveryCodes_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "UserTwoFactors" (
    "Id" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "SecretProtected" character varying(512),
    "EnabledAt" timestamp with time zone,
    "PendingSecretProtected" character varying(512),
    "PendingCreatedAt" timestamp with time zone,
    "LastUsedStep" bigint NOT NULL,
    "GraceStartedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_UserTwoFactors" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_UserTwoFactors_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "WaitlistOffers" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "ClassId" numeric(20,0) NOT NULL,
    "BookingId" numeric(20,0) NOT NULL,
    "ClientId" numeric(20,0) NOT NULL,
    "Status" character varying(16) NOT NULL,
    "OfferedAt" timestamp with time zone NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "RespondedAt" timestamp with time zone,
    CONSTRAINT "PK_WaitlistOffers" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WaitlistOffers_ClassBookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES "ClassBookings" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_WaitlistOffers_GymClasses_ClassId" FOREIGN KEY ("ClassId") REFERENCES "GymClasses" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_WaitlistOffers_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WaitlistOffers_Users_ClientId" FOREIGN KEY ("ClientId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "WaiverDocuments" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "Title" character varying(200) NOT NULL,
    "IsActive" boolean NOT NULL,
    "CreatedByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_WaiverDocuments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WaiverDocuments_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "AnnouncementRecipients" (
    "AnnouncementId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "DeliveredAt" timestamp with time zone NOT NULL,
    "ReadAt" timestamp with time zone,
    CONSTRAINT "PK_AnnouncementRecipients" PRIMARY KEY ("AnnouncementId", "UserId"),
    CONSTRAINT "FK_AnnouncementRecipients_Announcements_AnnouncementId" FOREIGN KEY ("AnnouncementId") REFERENCES "Announcements" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_AnnouncementRecipients_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_AnnouncementRecipients_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "WaiverVersions" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "WaiverId" numeric(20,0) NOT NULL,
    "Version" integer NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Body" character varying(50000) NOT NULL,
    "BodyHash" character varying(64) NOT NULL,
    "RequiresResign" boolean NOT NULL,
    "PublishedAt" timestamp with time zone NOT NULL,
    "PublishedByUserId" numeric(20,0),
    CONSTRAINT "PK_WaiverVersions" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WaiverVersions_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WaiverVersions_WaiverDocuments_WaiverId" FOREIGN KEY ("WaiverId") REFERENCES "WaiverDocuments" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "WaiverSignatures" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "WaiverId" numeric(20,0) NOT NULL,
    "WaiverVersionId" numeric(20,0) NOT NULL,
    "VersionNumber" integer NOT NULL,
    "SignedName" character varying(200) NOT NULL,
    "SignedAt" timestamp with time zone NOT NULL,
    "Ip" character varying(64),
    "UserAgent" character varying(512),
    "BodyHash" character varying(64) NOT NULL,
    "WitnessUserId" numeric(20,0),
    CONSTRAINT "PK_WaiverSignatures" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WaiverSignatures_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WaiverSignatures_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WaiverSignatures_WaiverDocuments_WaiverId" FOREIGN KEY ("WaiverId") REFERENCES "WaiverDocuments" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WaiverSignatures_WaiverVersions_WaiverVersionId" FOREIGN KEY ("WaiverVersionId") REFERENCES "WaiverVersions" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_AccountDeletionRequests_TenantId_Status_ScheduledFor" ON "AccountDeletionRequests" ("TenantId", "Status", "ScheduledFor");

CREATE INDEX "IX_AccountDeletionRequests_TenantId_UserId" ON "AccountDeletionRequests" ("TenantId", "UserId");

CREATE INDEX "IX_AccountDeletionRequests_UserId" ON "AccountDeletionRequests" ("UserId");

CREATE INDEX "IX_AnnouncementRecipients_TenantId" ON "AnnouncementRecipients" ("TenantId");

CREATE INDEX "IX_AnnouncementRecipients_UserId_ReadAt" ON "AnnouncementRecipients" ("UserId", "ReadAt");

CREATE INDEX "IX_Announcements_Status_PublishAt" ON "Announcements" ("Status", "PublishAt");

CREATE INDEX "IX_Announcements_TenantId_Status" ON "Announcements" ("TenantId", "Status");

CREATE UNIQUE INDEX "IX_BranchHoursExceptions_BranchId_Date" ON "BranchHoursExceptions" ("BranchId", "Date");

CREATE INDEX "IX_BranchHoursExceptions_TenantId" ON "BranchHoursExceptions" ("TenantId");

CREATE INDEX "IX_BranchOpeningIntervals_BranchId_DayOfWeek" ON "BranchOpeningIntervals" ("BranchId", "DayOfWeek");

CREATE INDEX "IX_BranchOpeningIntervals_TenantId" ON "BranchOpeningIntervals" ("TenantId");

CREATE UNIQUE INDEX "IX_BranchProfiles_BranchId" ON "BranchProfiles" ("BranchId");

CREATE INDEX "IX_BranchProfiles_TenantId" ON "BranchProfiles" ("TenantId");

CREATE INDEX "IX_ConsentRecords_TenantId_UserId_Type_At" ON "ConsentRecords" ("TenantId", "UserId", "Type", "At");

CREATE INDEX "IX_ConsentRecords_UserId" ON "ConsentRecords" ("UserId");

CREATE INDEX "IX_DataExportRequests_Status_RequestedAt" ON "DataExportRequests" ("Status", "RequestedAt");

CREATE INDEX "IX_DataExportRequests_TenantId_UserId_RequestedAt" ON "DataExportRequests" ("TenantId", "UserId", "RequestedAt");

CREATE INDEX "IX_DataExportRequests_UserId" ON "DataExportRequests" ("UserId");

CREATE INDEX "IX_HealthScreenings_TenantId_UserId_SubmittedAt" ON "HealthScreenings" ("TenantId", "UserId", "SubmittedAt");

CREATE INDEX "IX_HealthScreenings_UserId" ON "HealthScreenings" ("UserId");

CREATE INDEX "IX_MemberEmergencyContacts_TenantId" ON "MemberEmergencyContacts" ("TenantId");

CREATE UNIQUE INDEX "IX_MemberEmergencyContacts_UserId" ON "MemberEmergencyContacts" ("UserId");

CREATE INDEX "IX_MembershipRequests_MembershipId_Status" ON "MembershipRequests" ("MembershipId", "Status");

CREATE INDEX "IX_MembershipRequests_TenantId_Status_Type_RequestedAt" ON "MembershipRequests" ("TenantId", "Status", "Type", "RequestedAt");

CREATE INDEX "IX_MembershipRequests_TenantId_UserId" ON "MembershipRequests" ("TenantId", "UserId");

CREATE INDEX "IX_MembershipRequests_UserId" ON "MembershipRequests" ("UserId");

CREATE INDEX "IX_NotificationPreferences_TenantId" ON "NotificationPreferences" ("TenantId");

CREATE UNIQUE INDEX "IX_NotificationPreferences_UserId" ON "NotificationPreferences" ("UserId");

CREATE INDEX "IX_PushDevices_TenantId" ON "PushDevices" ("TenantId");

CREATE UNIQUE INDEX "IX_PushDevices_Token" ON "PushDevices" ("Token");

CREATE INDEX "IX_PushDevices_UserId_DisabledAt" ON "PushDevices" ("UserId", "DisabledAt");

CREATE INDEX "IX_SafetyGateOverrides_TenantId_UserId_At" ON "SafetyGateOverrides" ("TenantId", "UserId", "At");

CREATE INDEX "IX_SafetyGateOverrides_UserId" ON "SafetyGateOverrides" ("UserId");

CREATE INDEX "IX_ServiceStatuses_BranchId" ON "ServiceStatuses" ("BranchId");

CREATE INDEX "IX_ServiceStatuses_TenantId_BranchId_EndsAt" ON "ServiceStatuses" ("TenantId", "BranchId", "EndsAt");

CREATE UNIQUE INDEX "IX_TrustedDevices_TokenHash" ON "TrustedDevices" ("TokenHash");

CREATE INDEX "IX_TrustedDevices_UserId" ON "TrustedDevices" ("UserId");

CREATE UNIQUE INDEX "IX_TwoFactorChallenges_TokenHash" ON "TwoFactorChallenges" ("TokenHash");

CREATE INDEX "IX_TwoFactorChallenges_UserId" ON "TwoFactorChallenges" ("UserId");

CREATE INDEX "IX_TwoFactorRecoveryCodes_UserId" ON "TwoFactorRecoveryCodes" ("UserId");

CREATE UNIQUE INDEX "IX_UserTwoFactors_UserId" ON "UserTwoFactors" ("UserId");

CREATE INDEX "IX_WaitlistOffers_BookingId" ON "WaitlistOffers" ("BookingId");

CREATE INDEX "IX_WaitlistOffers_ClassId_Status" ON "WaitlistOffers" ("ClassId", "Status");

CREATE INDEX "IX_WaitlistOffers_ClientId_Status" ON "WaitlistOffers" ("ClientId", "Status");

CREATE INDEX "IX_WaitlistOffers_Status_ExpiresAt" ON "WaitlistOffers" ("Status", "ExpiresAt");

CREATE INDEX "IX_WaitlistOffers_TenantId" ON "WaitlistOffers" ("TenantId");

CREATE INDEX "IX_WaiverDocuments_TenantId_IsActive" ON "WaiverDocuments" ("TenantId", "IsActive");

CREATE INDEX "IX_WaiverSignatures_TenantId_UserId" ON "WaiverSignatures" ("TenantId", "UserId");

CREATE UNIQUE INDEX "IX_WaiverSignatures_UserId_WaiverVersionId" ON "WaiverSignatures" ("UserId", "WaiverVersionId");

CREATE INDEX "IX_WaiverSignatures_WaiverId" ON "WaiverSignatures" ("WaiverId");

CREATE INDEX "IX_WaiverSignatures_WaiverVersionId" ON "WaiverSignatures" ("WaiverVersionId");

CREATE INDEX "IX_WaiverVersions_TenantId" ON "WaiverVersions" ("TenantId");

CREATE UNIQUE INDEX "IX_WaiverVersions_WaiverId_Version" ON "WaiverVersions" ("WaiverId", "Version");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261105112722_MemberJourneyFeatures', '9.0.0');

CREATE SEQUENCE "BookingBlocks_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "BookingPenalties_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "ClassFeedbacks_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "Conversations_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "DirectMessages_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "FacilityAssets_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "FacilityMaintenances_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "FacilityReportComments_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "FacilityReports_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "IncidentAddenda_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "IncidentPeople_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "Incidents_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "MessagingUserSettings_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "SupportCannedReplies_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "SupportFaqs_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "SupportMessages_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "SupportRequests_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE TABLE "BookingBlocks" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "ClientId" numeric(20,0) NOT NULL,
    "From" timestamp with time zone NOT NULL,
    "Until" timestamp with time zone NOT NULL,
    "Reason" character varying(300) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "LiftedAt" timestamp with time zone,
    "LiftedBy" numeric(20,0),
    "LiftReason" character varying(500),
    "EndNotifiedAt" timestamp with time zone,
    CONSTRAINT "PK_BookingBlocks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BookingBlocks_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_BookingBlocks_Users_ClientId" FOREIGN KEY ("ClientId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "BookingPenalties" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "ClientId" numeric(20,0) NOT NULL,
    "Type" character varying(20) NOT NULL,
    "BookingId" numeric(20,0),
    "ClassId" numeric(20,0),
    "PtSessionId" numeric(20,0),
    "SessionStartsAt" timestamp with time zone NOT NULL,
    "FeeAmount" numeric(18,2),
    "FeeInvoiceId" numeric(20,0),
    "Strike" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "CreatedBy" numeric(20,0),
    "Waived" boolean NOT NULL,
    "WaivedAt" timestamp with time zone,
    "WaivedBy" numeric(20,0),
    "WaiveReason" character varying(500),
    CONSTRAINT "PK_BookingPenalties" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BookingPenalties_Invoices_FeeInvoiceId" FOREIGN KEY ("FeeInvoiceId") REFERENCES "Invoices" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_BookingPenalties_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_BookingPenalties_Users_ClientId" FOREIGN KEY ("ClientId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "ClassFeedbacks" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BookingId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "ClassId" numeric(20,0) NOT NULL,
    "ClassTypeId" numeric(20,0) NOT NULL,
    "TrainerId" numeric(20,0),
    "Score" smallint,
    "Comment" character varying(1000),
    "Skipped" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_ClassFeedbacks" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_ClassFeedbacks_ClassBookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES "ClassBookings" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_ClassFeedbacks_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_ClassFeedbacks_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Conversations" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "TrainerUserId" numeric(20,0) NOT NULL,
    "MemberUserId" numeric(20,0) NOT NULL,
    "LastMessageAt" timestamp with time zone,
    "LastMessagePreview" character varying(200),
    "LastMessageSenderId" numeric(20,0),
    "MemberLastReadAt" timestamp with time zone,
    "TrainerLastReadAt" timestamp with time zone,
    "MemberMuted" boolean NOT NULL,
    "TrainerMuted" boolean NOT NULL,
    "MemberRedactedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Conversations" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Conversations_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Conversations_Users_MemberUserId" FOREIGN KEY ("MemberUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Conversations_Users_TrainerUserId" FOREIGN KEY ("TrainerUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "FacilityAssets" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0) NOT NULL,
    "Name" character varying(120) NOT NULL,
    "AssetType" character varying(80),
    "EquipmentId" integer,
    "Zone" character varying(80),
    "PhotoUrl" character varying(1000),
    "SerialNumber" character varying(120),
    "AssetCode" character varying(40) NOT NULL,
    "IsKeyFacility" boolean NOT NULL,
    "Status" character varying(20) NOT NULL,
    "StatusReason" character varying(500),
    "StatusSince" timestamp with time zone NOT NULL,
    "ExpectedBackOn" date,
    "StatusChangedByUserId" numeric(20,0),
    "ServiceStatusId" numeric(20,0),
    "LastServicedOn" date,
    "NextServiceDue" date,
    "Notes" character varying(2000),
    "ArchivedAt" timestamp with time zone,
    "CreatedByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FacilityAssets" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_FacilityAssets_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FacilityAssets_Equipment_EquipmentId" FOREIGN KEY ("EquipmentId") REFERENCES "Equipment" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_FacilityAssets_ServiceStatuses_ServiceStatusId" FOREIGN KEY ("ServiceStatusId") REFERENCES "ServiceStatuses" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_FacilityAssets_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "MessagingUserSettings" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "AllowTrainerMessages" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_MessagingUserSettings" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_MessagingUserSettings_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_MessagingUserSettings_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "SupportCannedReplies" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "Title" character varying(100) NOT NULL,
    "Body" character varying(4000) NOT NULL,
    "SortOrder" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SupportCannedReplies" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SupportCannedReplies_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "SupportFaqs" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "Question" character varying(300) NOT NULL,
    "Answer" character varying(4000) NOT NULL,
    "Category" character varying(30),
    "SortOrder" integer NOT NULL,
    "IsPublished" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SupportFaqs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SupportFaqs_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "SupportRequests" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0),
    "Category" character varying(30) NOT NULL,
    "Subject" character varying(150) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "Priority" character varying(20) NOT NULL,
    "AssigneeId" numeric(20,0),
    "CanContact" boolean NOT NULL,
    "ContactMethod" character varying(20),
    "FirstResponseAt" timestamp with time zone,
    "ResolvedAt" timestamp with time zone,
    "ClosedAt" timestamp with time zone,
    "ReopenedAt" timestamp with time zone,
    "ReopenCount" integer NOT NULL,
    "LastMessageAt" timestamp with time zone NOT NULL,
    "LastMessageBy" character varying(20),
    "Rating" smallint,
    "RatingComment" character varying(1000),
    "RatedAt" timestamp with time zone,
    "RedactedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SupportRequests" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SupportRequests_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_SupportRequests_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_SupportRequests_Users_AssigneeId" FOREIGN KEY ("AssigneeId") REFERENCES "Users" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_SupportRequests_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "DirectMessages" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "ConversationId" numeric(20,0) NOT NULL,
    "SenderId" numeric(20,0) NOT NULL,
    "ClientMessageId" character varying(64) NOT NULL,
    "Body" character varying(2000) NOT NULL,
    "PhotoUrl" character varying(1000),
    "AttachmentType" character varying(20),
    "AttachmentId" numeric(20,0),
    "AttachmentTargetId" numeric(20,0),
    "AttachmentTitle" character varying(200),
    "ReportedAt" timestamp with time zone,
    "ReportedById" numeric(20,0),
    "ReportRequestId" numeric(20,0),
    "RedactedAt" timestamp with time zone,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_DirectMessages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_DirectMessages_Conversations_ConversationId" FOREIGN KEY ("ConversationId") REFERENCES "Conversations" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_DirectMessages_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_DirectMessages_Users_SenderId" FOREIGN KEY ("SenderId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "FacilityMaintenances" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "AssetId" numeric(20,0) NOT NULL,
    "PerformedOn" date NOT NULL,
    "Work" character varying(2000) NOT NULL,
    "PerformedBy" character varying(150),
    "Cost" numeric(18,2),
    "NextServiceDue" date,
    "CreatedByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FacilityMaintenances" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_FacilityMaintenances_FacilityAssets_AssetId" FOREIGN KEY ("AssetId") REFERENCES "FacilityAssets" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_FacilityMaintenances_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "FacilityReports" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0) NOT NULL,
    "AssetId" numeric(20,0),
    "OtherLocation" character varying(200),
    "ProblemType" character varying(20) NOT NULL,
    "Description" character varying(2000),
    "PhotoUrls" character varying(3100),
    "ReporterUserId" numeric(20,0) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "IsUrgent" boolean NOT NULL,
    "AssignedToUserId" numeric(20,0),
    "ResolutionNote" character varying(1000),
    "ResolvedAt" timestamp with time zone,
    "ResolvedByUserId" numeric(20,0),
    "PlusOneCount" integer NOT NULL,
    "LastActivityAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FacilityReports" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_FacilityReports_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FacilityReports_FacilityAssets_AssetId" FOREIGN KEY ("AssetId") REFERENCES "FacilityAssets" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_FacilityReports_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FacilityReports_Users_ReporterUserId" FOREIGN KEY ("ReporterUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "Incidents" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0) NOT NULL,
    "OccurredAt" timestamp with time zone NOT NULL,
    "Location" character varying(200) NOT NULL,
    "Type" character varying(30) NOT NULL,
    "Severity" character varying(20) NOT NULL,
    "Description" character varying(10000) NOT NULL,
    "FirstAidGiven" boolean NOT NULL,
    "FirstAidBy" character varying(150),
    "AmbulanceCalled" boolean NOT NULL,
    "Witnesses" character varying(2000),
    "FollowUpActions" character varying(4000),
    "AttachmentUrls" character varying(10000),
    "AssetId" numeric(20,0),
    "Status" character varying(20) NOT NULL,
    "ClosedAt" timestamp with time zone,
    "ClosedByUserId" numeric(20,0),
    "ClosureNote" character varying(2000),
    "ReportedByUserId" numeric(20,0) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Incidents" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Incidents_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Incidents_FacilityAssets_AssetId" FOREIGN KEY ("AssetId") REFERENCES "FacilityAssets" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_Incidents_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Incidents_Users_ReportedByUserId" FOREIGN KEY ("ReportedByUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "SupportMessages" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "RequestId" numeric(20,0) NOT NULL,
    "AuthorId" numeric(20,0),
    "AuthorRole" character varying(20) NOT NULL,
    "Kind" character varying(20) NOT NULL,
    "IsInternal" boolean NOT NULL,
    "Body" character varying(4000) NOT NULL,
    "Photos" jsonb,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_SupportMessages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SupportMessages_SupportRequests_RequestId" FOREIGN KEY ("RequestId") REFERENCES "SupportRequests" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SupportMessages_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_SupportMessages_Users_AuthorId" FOREIGN KEY ("AuthorId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "FacilityReportComments" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "ReportId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "Body" character varying(1000) NOT NULL,
    "IsStaff" boolean NOT NULL,
    "IsInternal" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FacilityReportComments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_FacilityReportComments_FacilityReports_ReportId" FOREIGN KEY ("ReportId") REFERENCES "FacilityReports" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_FacilityReportComments_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FacilityReportComments_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "FacilityReportFollowers" (
    "ReportId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FacilityReportFollowers" PRIMARY KEY ("ReportId", "UserId"),
    CONSTRAINT "FK_FacilityReportFollowers_FacilityReports_ReportId" FOREIGN KEY ("ReportId") REFERENCES "FacilityReports" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_FacilityReportFollowers_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FacilityReportFollowers_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "IncidentAddenda" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "IncidentId" numeric(20,0) NOT NULL,
    "Body" character varying(5000) NOT NULL,
    "AuthorUserId" numeric(20,0) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_IncidentAddenda" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_IncidentAddenda_Incidents_IncidentId" FOREIGN KEY ("IncidentId") REFERENCES "Incidents" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_IncidentAddenda_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_IncidentAddenda_Users_AuthorUserId" FOREIGN KEY ("AuthorUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE TABLE "IncidentPeople" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "IncidentId" numeric(20,0) NOT NULL,
    "Kind" character varying(20) NOT NULL,
    "UserId" numeric(20,0),
    "Name" character varying(150) NOT NULL,
    "Contact" character varying(200),
    "IsInjuredParty" boolean NOT NULL,
    "Notes" character varying(1000),
    CONSTRAINT "PK_IncidentPeople" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_IncidentPeople_Incidents_IncidentId" FOREIGN KEY ("IncidentId") REFERENCES "Incidents" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_IncidentPeople_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_IncidentPeople_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_BookingBlocks_ClientId" ON "BookingBlocks" ("ClientId");

CREATE INDEX "IX_BookingBlocks_TenantId_ClientId_Until" ON "BookingBlocks" ("TenantId", "ClientId", "Until");

CREATE INDEX "IX_BookingPenalties_ClientId" ON "BookingPenalties" ("ClientId");

CREATE INDEX "IX_BookingPenalties_FeeInvoiceId" ON "BookingPenalties" ("FeeInvoiceId");

CREATE INDEX "IX_BookingPenalties_TenantId_ClassId" ON "BookingPenalties" ("TenantId", "ClassId");

CREATE INDEX "IX_BookingPenalties_TenantId_ClientId_CreatedAt" ON "BookingPenalties" ("TenantId", "ClientId", "CreatedAt");

CREATE UNIQUE INDEX "IX_BookingPenalties_TenantId_Type_BookingId" ON "BookingPenalties" ("TenantId", "Type", "BookingId") WHERE "BookingId" IS NOT NULL;

CREATE UNIQUE INDEX "IX_BookingPenalties_TenantId_Type_PtSessionId" ON "BookingPenalties" ("TenantId", "Type", "PtSessionId") WHERE "PtSessionId" IS NOT NULL;

CREATE UNIQUE INDEX "IX_ClassFeedbacks_BookingId" ON "ClassFeedbacks" ("BookingId");

CREATE INDEX "IX_ClassFeedbacks_TenantId_ClassTypeId" ON "ClassFeedbacks" ("TenantId", "ClassTypeId");

CREATE INDEX "IX_ClassFeedbacks_TenantId_TrainerId" ON "ClassFeedbacks" ("TenantId", "TrainerId");

CREATE INDEX "IX_ClassFeedbacks_TenantId_UserId" ON "ClassFeedbacks" ("TenantId", "UserId");

CREATE INDEX "IX_ClassFeedbacks_UserId" ON "ClassFeedbacks" ("UserId");

CREATE INDEX "IX_Conversations_MemberUserId" ON "Conversations" ("MemberUserId");

CREATE INDEX "IX_Conversations_TenantId_LastMessageAt" ON "Conversations" ("TenantId", "LastMessageAt");

CREATE INDEX "IX_Conversations_TenantId_MemberUserId_LastMessageAt" ON "Conversations" ("TenantId", "MemberUserId", "LastMessageAt");

CREATE UNIQUE INDEX "IX_Conversations_TenantId_TrainerUserId_MemberUserId" ON "Conversations" ("TenantId", "TrainerUserId", "MemberUserId");

CREATE INDEX "IX_Conversations_TrainerUserId" ON "Conversations" ("TrainerUserId");

CREATE INDEX "IX_DirectMessages_ConversationId_CreatedAt" ON "DirectMessages" ("ConversationId", "CreatedAt");

CREATE UNIQUE INDEX "IX_DirectMessages_SenderId_ClientMessageId" ON "DirectMessages" ("SenderId", "ClientMessageId");

CREATE INDEX "IX_DirectMessages_SenderId_CreatedAt" ON "DirectMessages" ("SenderId", "CreatedAt");

CREATE INDEX "IX_DirectMessages_TenantId_ReportedAt" ON "DirectMessages" ("TenantId", "ReportedAt");

CREATE INDEX "IX_FacilityAssets_BranchId" ON "FacilityAssets" ("BranchId");

CREATE INDEX "IX_FacilityAssets_EquipmentId" ON "FacilityAssets" ("EquipmentId");

CREATE INDEX "IX_FacilityAssets_ServiceStatusId" ON "FacilityAssets" ("ServiceStatusId");

CREATE UNIQUE INDEX "IX_FacilityAssets_TenantId_AssetCode" ON "FacilityAssets" ("TenantId", "AssetCode");

CREATE INDEX "IX_FacilityAssets_TenantId_BranchId_Status" ON "FacilityAssets" ("TenantId", "BranchId", "Status");

CREATE INDEX "IX_FacilityAssets_TenantId_BranchId_Zone" ON "FacilityAssets" ("TenantId", "BranchId", "Zone");

CREATE INDEX "IX_FacilityMaintenances_AssetId_PerformedOn" ON "FacilityMaintenances" ("AssetId", "PerformedOn");

CREATE INDEX "IX_FacilityMaintenances_TenantId" ON "FacilityMaintenances" ("TenantId");

CREATE INDEX "IX_FacilityReportComments_ReportId_CreatedAt" ON "FacilityReportComments" ("ReportId", "CreatedAt");

CREATE INDEX "IX_FacilityReportComments_TenantId" ON "FacilityReportComments" ("TenantId");

CREATE INDEX "IX_FacilityReportComments_UserId" ON "FacilityReportComments" ("UserId");

CREATE INDEX "IX_FacilityReportFollowers_TenantId" ON "FacilityReportFollowers" ("TenantId");

CREATE INDEX "IX_FacilityReportFollowers_UserId" ON "FacilityReportFollowers" ("UserId");

CREATE INDEX "IX_FacilityReports_AssetId" ON "FacilityReports" ("AssetId");

CREATE INDEX "IX_FacilityReports_BranchId" ON "FacilityReports" ("BranchId");

CREATE INDEX "IX_FacilityReports_ReporterUserId_CreatedAt" ON "FacilityReports" ("ReporterUserId", "CreatedAt");

CREATE INDEX "IX_FacilityReports_TenantId_AssetId_Status" ON "FacilityReports" ("TenantId", "AssetId", "Status");

CREATE INDEX "IX_FacilityReports_TenantId_Status_IsUrgent" ON "FacilityReports" ("TenantId", "Status", "IsUrgent");

CREATE INDEX "IX_IncidentAddenda_AuthorUserId" ON "IncidentAddenda" ("AuthorUserId");

CREATE INDEX "IX_IncidentAddenda_IncidentId_CreatedAt" ON "IncidentAddenda" ("IncidentId", "CreatedAt");

CREATE INDEX "IX_IncidentAddenda_TenantId" ON "IncidentAddenda" ("TenantId");

CREATE INDEX "IX_IncidentPeople_IncidentId" ON "IncidentPeople" ("IncidentId");

CREATE INDEX "IX_IncidentPeople_TenantId_UserId" ON "IncidentPeople" ("TenantId", "UserId");

CREATE INDEX "IX_IncidentPeople_UserId" ON "IncidentPeople" ("UserId");

CREATE INDEX "IX_Incidents_AssetId" ON "Incidents" ("AssetId");

CREATE INDEX "IX_Incidents_BranchId" ON "Incidents" ("BranchId");

CREATE INDEX "IX_Incidents_ReportedByUserId" ON "Incidents" ("ReportedByUserId");

CREATE INDEX "IX_Incidents_TenantId_BranchId_OccurredAt" ON "Incidents" ("TenantId", "BranchId", "OccurredAt");

CREATE INDEX "IX_Incidents_TenantId_Status_OccurredAt" ON "Incidents" ("TenantId", "Status", "OccurredAt");

CREATE INDEX "IX_MessagingUserSettings_TenantId" ON "MessagingUserSettings" ("TenantId");

CREATE UNIQUE INDEX "IX_MessagingUserSettings_UserId" ON "MessagingUserSettings" ("UserId");

CREATE INDEX "IX_SupportCannedReplies_TenantId_SortOrder" ON "SupportCannedReplies" ("TenantId", "SortOrder");

CREATE INDEX "IX_SupportFaqs_TenantId_SortOrder" ON "SupportFaqs" ("TenantId", "SortOrder");

CREATE INDEX "IX_SupportMessages_AuthorId" ON "SupportMessages" ("AuthorId");

CREATE INDEX "IX_SupportMessages_RequestId_CreatedAt" ON "SupportMessages" ("RequestId", "CreatedAt");

CREATE INDEX "IX_SupportMessages_TenantId" ON "SupportMessages" ("TenantId");

CREATE INDEX "IX_SupportRequests_AssigneeId" ON "SupportRequests" ("AssigneeId");

CREATE INDEX "IX_SupportRequests_BranchId" ON "SupportRequests" ("BranchId");

CREATE INDEX "IX_SupportRequests_TenantId_AssigneeId_Status" ON "SupportRequests" ("TenantId", "AssigneeId", "Status");

CREATE INDEX "IX_SupportRequests_TenantId_Status_LastMessageAt" ON "SupportRequests" ("TenantId", "Status", "LastMessageAt");

CREATE INDEX "IX_SupportRequests_TenantId_UserId_CreatedAt" ON "SupportRequests" ("TenantId", "UserId", "CreatedAt");

CREATE INDEX "IX_SupportRequests_UserId" ON "SupportRequests" ("UserId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261105164355_SupportFacilitiesMessagingRules', '9.0.0');

DROP INDEX "IX_WorkoutPlans_TenantId";

CREATE SEQUENCE "PersonalRecords_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "PlanDayOverrides_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "WorkoutSetLogs_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

ALTER TABLE "WorkoutTemplates" ADD "OwnerPlanDayId" numeric(20,0);

ALTER TABLE "WorkoutPlans" ADD "DaysPerWeekHint" smallint;

ALTER TABLE "WorkoutPlans" ADD "IsTemplate" boolean NOT NULL DEFAULT TRUE;

ALTER TABLE "WorkoutPlans" ADD "OwnerClientId" numeric(20,0);

ALTER TABLE "WorkoutPlans" ADD "SourcePlanId" numeric(20,0);

ALTER TABLE "WorkoutPlanDays" ADD "Notes" character varying(2000);

ALTER TABLE "WorkoutPlanDays" ADD "Title" character varying(100);

ALTER TABLE "WorkoutLogs" ADD "DayNumber" smallint;

ALTER TABLE "WorkoutLogs" ADD "PlanAssignmentId" numeric(20,0);

ALTER TABLE "WorkoutLogs" ADD "SessionRpe" smallint;

ALTER TABLE "WorkoutLogs" ADD "WeekNumber" smallint;

ALTER TABLE "WorkoutExercises" ADD "SetTargets" jsonb;

CREATE TABLE "PlanDayOverrides" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "PlanAssignmentId" numeric(20,0) NOT NULL,
    "Date" date NOT NULL,
    "Action" integer NOT NULL,
    "MovedToDate" date,
    "ByUserId" numeric(20,0),
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PlanDayOverrides" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PlanDayOverrides_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_PlanDayOverrides_Users_ByUserId" FOREIGN KEY ("ByUserId") REFERENCES "Users" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_PlanDayOverrides_WorkoutPlanAssignments_PlanAssignmentId" FOREIGN KEY ("PlanAssignmentId") REFERENCES "WorkoutPlanAssignments" ("Id") ON DELETE CASCADE
);

CREATE TABLE "WorkoutSetLogs" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "WorkoutLogId" numeric(20,0) NOT NULL,
    "ClientId" numeric(20,0) NOT NULL,
    "ExerciseId" numeric(20,0) NOT NULL,
    "WorkoutExerciseId" numeric(20,0),
    "SetNo" smallint NOT NULL,
    "SetType" integer NOT NULL,
    "Reps" integer,
    "WeightKg" numeric(7,2),
    "Rpe" numeric(3,1),
    "DurationSec" integer,
    "DistanceM" numeric(9,2),
    "Completed" boolean NOT NULL,
    "PerformedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_WorkoutSetLogs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_WorkoutSetLogs_Exercises_ExerciseId" FOREIGN KEY ("ExerciseId") REFERENCES "Exercises" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WorkoutSetLogs_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WorkoutSetLogs_Users_ClientId" FOREIGN KEY ("ClientId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_WorkoutSetLogs_WorkoutExercises_WorkoutExerciseId" FOREIGN KEY ("WorkoutExerciseId") REFERENCES "WorkoutExercises" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_WorkoutSetLogs_WorkoutLogs_WorkoutLogId" FOREIGN KEY ("WorkoutLogId") REFERENCES "WorkoutLogs" ("Id") ON DELETE CASCADE
);

CREATE TABLE "PersonalRecords" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "ClientId" numeric(20,0) NOT NULL,
    "ExerciseId" numeric(20,0) NOT NULL,
    "Type" integer NOT NULL,
    "Value" numeric(10,2) NOT NULL,
    "Reps" integer,
    "WeightKg" numeric(7,2),
    "WorkoutSetLogId" numeric(20,0),
    "WorkoutLogId" numeric(20,0),
    "AchievedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_PersonalRecords" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_PersonalRecords_Exercises_ExerciseId" FOREIGN KEY ("ExerciseId") REFERENCES "Exercises" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_PersonalRecords_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_PersonalRecords_Users_ClientId" FOREIGN KEY ("ClientId") REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_PersonalRecords_WorkoutLogs_WorkoutLogId" FOREIGN KEY ("WorkoutLogId") REFERENCES "WorkoutLogs" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_PersonalRecords_WorkoutSetLogs_WorkoutSetLogId" FOREIGN KEY ("WorkoutSetLogId") REFERENCES "WorkoutSetLogs" ("Id") ON DELETE SET NULL
);

CREATE INDEX "IX_WorkoutTemplates_OwnerPlanDayId" ON "WorkoutTemplates" ("OwnerPlanDayId");

CREATE INDEX "IX_WorkoutPlans_OwnerClientId" ON "WorkoutPlans" ("OwnerClientId");

CREATE INDEX "IX_WorkoutPlans_SourcePlanId" ON "WorkoutPlans" ("SourcePlanId");

CREATE INDEX "IX_WorkoutPlans_TenantId_IsTemplate" ON "WorkoutPlans" ("TenantId", "IsTemplate");

CREATE INDEX "IX_WorkoutLogs_PlanAssignmentId_WeekNumber_DayNumber" ON "WorkoutLogs" ("PlanAssignmentId", "WeekNumber", "DayNumber");

CREATE UNIQUE INDEX "IX_PersonalRecords_ClientId_ExerciseId_Type" ON "PersonalRecords" ("ClientId", "ExerciseId", "Type");

CREATE INDEX "IX_PersonalRecords_ExerciseId" ON "PersonalRecords" ("ExerciseId");

CREATE INDEX "IX_PersonalRecords_TenantId" ON "PersonalRecords" ("TenantId");

CREATE INDEX "IX_PersonalRecords_WorkoutLogId" ON "PersonalRecords" ("WorkoutLogId");

CREATE INDEX "IX_PersonalRecords_WorkoutSetLogId" ON "PersonalRecords" ("WorkoutSetLogId");

CREATE INDEX "IX_PlanDayOverrides_ByUserId" ON "PlanDayOverrides" ("ByUserId");

CREATE UNIQUE INDEX "IX_PlanDayOverrides_PlanAssignmentId_Date" ON "PlanDayOverrides" ("PlanAssignmentId", "Date");

CREATE INDEX "IX_PlanDayOverrides_TenantId" ON "PlanDayOverrides" ("TenantId");

CREATE INDEX "IX_WorkoutSetLogs_ClientId_ExerciseId_PerformedAt" ON "WorkoutSetLogs" ("ClientId", "ExerciseId", "PerformedAt");

CREATE INDEX "IX_WorkoutSetLogs_ExerciseId" ON "WorkoutSetLogs" ("ExerciseId");

CREATE INDEX "IX_WorkoutSetLogs_TenantId" ON "WorkoutSetLogs" ("TenantId");

CREATE INDEX "IX_WorkoutSetLogs_WorkoutExerciseId" ON "WorkoutSetLogs" ("WorkoutExerciseId");

CREATE INDEX "IX_WorkoutSetLogs_WorkoutLogId" ON "WorkoutSetLogs" ("WorkoutLogId");

ALTER TABLE "WorkoutLogs" ADD CONSTRAINT "FK_WorkoutLogs_WorkoutPlanAssignments_PlanAssignmentId" FOREIGN KEY ("PlanAssignmentId") REFERENCES "WorkoutPlanAssignments" ("Id") ON DELETE SET NULL;

ALTER TABLE "WorkoutPlans" ADD CONSTRAINT "FK_WorkoutPlans_Users_OwnerClientId" FOREIGN KEY ("OwnerClientId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;

ALTER TABLE "WorkoutPlans" ADD CONSTRAINT "FK_WorkoutPlans_WorkoutPlans_SourcePlanId" FOREIGN KEY ("SourcePlanId") REFERENCES "WorkoutPlans" ("Id") ON DELETE SET NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261106143243_WeeklyPlanBuilder', '9.0.0');

COMMIT;

