using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <summary>
    /// ARCH-004 / ARCH-040: race-free ids. Every table with a single ulong (numeric(20,0)) "Id" key
    /// gets its own sequence "{Table}_Id_hilo_seq" (INCREMENT BY 10 = IdSequenceValueGenerator.BlockSize),
    /// positioned just past the table's current MAX(id), so the app's HiLo generator never hands out
    /// an id that already exists. The unused global_id_seq column defaults (FixUlongAutoIncrement)
    /// are removed together with the sequence.
    ///
    /// Safe on a populated database: no table is rewritten, no row or column changes. Re-runnable:
    /// CREATE SEQUENCE IF NOT EXISTS, and setval only ever moves a sequence forward.
    /// </summary>
    public partial class IdSequences : Migration
    {
        private const int BlockSize = 10;

        /// <summary>Table and its Id column (Social tables rename the column).</summary>
        private static readonly (string Table, string Column)[] Tables =
        [
            ("AccessDevices", "Id"),
            ("AccessEvents", "Id"),
            ("AssessmentTemplates", "Id"),
            ("Attendances", "Id"),
            ("AuditLogs", "Id"),
            ("AuthCodes", "Id"),
            ("Branches", "Id"),
            ("ChallengeParticipants", "Id"),
            ("Challenges", "Id"),
            ("ClassBookings", "Id"),
            ("ClassTypes", "Id"),
            ("ClientAssessments", "Id"),
            ("ClientProfiles", "Id"),
            ("CommunicationLogs", "Id"),
            ("CorporateAccounts", "Id"),
            ("CouponRedemptions", "Id"),
            ("Coupons", "Id"),
            ("Exercises", "Id"),
            ("GymClasses", "Id"),
            ("GymMemberships", "Id"),
            ("HabitLogs", "Id"),
            ("HabitTrackers", "Id"),
            ("HealthMetrics", "Id"),
            ("Invoices", "Id"),
            ("LeadActivities", "Id"),
            ("Leads", "Id"),
            ("MediaLibraries", "Id"),
            ("MembershipPlans", "Id"),
            ("ModuleAccesses", "Id"),
            ("Modules", "Id"),
            ("Notifications", "Id"),
            ("OnboardingSteps", "Id"),
            ("PaymentGateways", "Id"),
            ("Payments", "Id"),
            ("Permissions", "Id"),
            ("PricingRules", "Id"),
            ("PtSessions", "Id"),
            ("PtSessionTypes", "Id"),
            ("Ratings", "Id"),
            ("RoleModuleGrants", "Id"),
            ("Roles", "Id"),
            ("ShopAddresses", "Id"),
            ("ShopCartItems", "Id"),
            ("ShopCarts", "Id"),
            ("ShopCategories", "Id"),
            ("ShopInventories", "Id"),
            ("ShopOrderItems", "Id"),
            ("ShopOrders", "Id"),
            ("ShopPayments", "Id"),
            ("ShopProductImages", "Id"),
            ("ShopProducts", "Id"),
            ("ShopReviews", "Id"),
            ("ShopVariants", "Id"),
            ("ShopWishlistItems", "Id"),
            ("ShopWishlists", "Id"),
            ("SocialPostComments", "CommentId"),
            ("SocialPostImages", "ImageId"),
            ("SocialPostLikes", "LikeId"),
            ("SocialPosts", "PostId"),
            ("SsoProviders", "Id"),
            ("Tags", "Id"),
            ("Tenants", "Id"),
            ("TenantSettings", "Id"),
            ("TrainerAvailabilitySlots", "Id"),
            ("TrainerClientAssignments", "Id"),
            ("TrainerProfiles", "Id"),
            ("TrainerTimeOffs", "Id"),
            ("TransformationJournals", "Id"),
            ("UserModuleAccesses", "Id"),
            ("UserRoles", "Id"),
            ("Users", "Id"),
            ("UserSessions", "Id"),
            ("WorkoutAssignments", "Id"),
            ("WorkoutAutomationLogs", "Id"),
            ("WorkoutAutomationRules", "Id"),
            ("WorkoutBookmarks", "Id"),
            ("WorkoutExercises", "Id"),
            ("WorkoutLogs", "Id"),
            ("WorkoutPlanAssignments", "Id"),
            ("WorkoutPlanBranches", "Id"),
            ("WorkoutPlanDays", "Id"),
            ("WorkoutPlans", "Id"),
            ("WorkoutPlanWeeks", "Id"),
            ("WorkoutSections", "Id"),
            ("WorkoutTemplates", "Id"),
        ];

        /// <summary>The tables FixUlongAutoIncrement gave a global_id_seq default (restored by Down).</summary>
        private static readonly string[] GlobalSeqTables =
        [
            "Tenants", "Branches", "TenantSettings", "Roles", "Users", "UserSessions", "SsoProviders",
            "Permissions", "MembershipPlans", "GymMemberships", "CorporateAccounts", "Invoices", "Payments",
            "PaymentGateways", "Coupons", "CouponRedemptions", "WorkoutTemplates", "WorkoutSections",
            "WorkoutExercises", "WorkoutAssignments", "WorkoutLogs", "WorkoutLogSets", "WorkoutProgressions",
            "WorkoutPlans", "WorkoutPlanWeeks", "WorkoutPlanDays", "WorkoutPlanAssignments",
            "WorkoutPlanBranches", "WorkoutAutomationRules", "WorkoutAutomationLogs", "TrainerProfiles",
            "TrainerClientAssignments", "TrainerAvailabilitySlots", "TrainerTimeOffs", "PtSessionTypes",
            "PtSessions", "ClassTypes", "GymClasses", "ClassBookings", "Attendances", "ClientProfiles",
            "ClientGoals", "HealthMetrics", "InjuryRecords", "HabitTrackers", "HabitLogs",
            "TransformationJournals", "WearableDevices", "FoodItems", "DietPlans", "NutritionLogs", "Leads",
            "LeadActivities", "Referrals", "ReferralPrograms", "Achievements", "UserAchievements",
            "Challenges", "ChallengeParticipants", "Notifications", "NotificationTemplates", "Campaigns",
            "CommunicationLogs", "FeedbackSurveys", "FeedbackResponses", "Webhooks", "WebhookDeliveries",
            "AutomationRules", "AutomationLogs", "ScheduledTasks", "FacilityEquipments",
            "EquipmentMaintenanceLogs", "EquipmentBookings", "Lockers", "LockerAssignments", "AccessDevices",
            "AccessEvents", "PayrollConfigs", "PayrollPeriods", "PayrollSlips", "AnalyticsDailys",
            "TrainerAnalyticsDailys", "AiChatSessions", "AiChatMessages", "MlPredictions", "PoseLogs",
            "ApiKeys", "AuditLogs", "AssessmentTemplates", "ClientAssessments", "CustomFieldDefinitions",
            "CustomPages", "ExportJobs", "FeatureFlags", "MediaLibraries", "NavigationMenus",
            "OnboardingSteps", "Plugins", "PricingRules", "Ratings", "SearchIndexCaches", "SocialPosts",
            "SupportTickets", "SupportTicketReplies", "Tags", "TenantFeatureOverrides", "TenantPlugins",
            "UiThemes", "VirtualSessions", "PosProducts", "PosOrders", "PosOrderItems"
        ];

        private static string Seq(string table) => $"{table}_Id_hilo_seq";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var (table, column) in Tables)
            {
                var seq = Seq(table);
                migrationBuilder.Sql(
                    $"CREATE SEQUENCE IF NOT EXISTS \"{seq}\" AS bigint START WITH 1 INCREMENT BY {BlockSize} NO CYCLE;");
                // Next nextval() = MAX(id) + 1 (is_called = false), unless the sequence is already
                // further along (re-run): then it is left where it is.
                migrationBuilder.Sql($"""
                    SELECT setval('"{seq}"', GREATEST(
                        (SELECT COALESCE(MAX("{column}"), 0) + 1 FROM "{table}")::bigint,
                        (SELECT CASE WHEN is_called THEN last_value + {BlockSize} ELSE last_value END FROM "{seq}")),
                        false);
                    """);
            }

            // ARCH-040: the app always sends the id, so these defaults were never used; drop them
            // (wherever they still exist) and the sequence they pointed at.
            migrationBuilder.Sql("""
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
                """);
            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS global_id_seq;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var (table, _) in Tables)
                migrationBuilder.Sql($"DROP SEQUENCE IF EXISTS \"{Seq(table)}\";");

            // Put back global_id_seq and its defaults on the listed tables that still have an "Id" column.
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS global_id_seq START 1 INCREMENT 1;");
            foreach (var table in GlobalSeqTables)
                migrationBuilder.Sql($"""
                    DO $$
                    BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.columns
                                   WHERE table_schema = current_schema() AND table_name = '{table}' AND column_name = 'Id') THEN
                            ALTER TABLE "{table}" ALTER COLUMN "Id" SET DEFAULT nextval('global_id_seq');
                        END IF;
                    END $$;
                    """);
        }
    }
}
