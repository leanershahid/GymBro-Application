using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class FixUlongAutoIncrement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create a shared sequence for all ulong (numeric(20,0)) PKs
            migrationBuilder.Sql("CREATE SEQUENCE IF NOT EXISTS global_id_seq START 1 INCREMENT 1;");

            // Set default for all tables with numeric(20,0) Id
            var tables = new[]
            {
                "Tenants", "Branches", "TenantSettings", "Roles", "Users", "UserSessions",
                "SsoProviders", "Permissions", "MembershipPlans", "GymMemberships",
                "CorporateAccounts", "Invoices", "Payments", "PaymentGateways", "Coupons",
                "CouponRedemptions", "WorkoutTemplates", "WorkoutSections", "WorkoutExercises",
                "WorkoutAssignments", "WorkoutLogs", "WorkoutLogSets", "WorkoutProgressions",
                "WorkoutPlans", "WorkoutPlanWeeks", "WorkoutPlanDays", "WorkoutPlanAssignments",
                "WorkoutPlanBranches", "WorkoutAutomationRules", "WorkoutAutomationLogs",
                "TrainerProfiles", "TrainerClientAssignments", "TrainerAvailabilitySlots",
                "TrainerTimeOffs", "PtSessionTypes", "PtSessions", "ClassTypes", "GymClasses",
                "ClassBookings", "Attendances", "ClientProfiles", "ClientGoals", "HealthMetrics",
                "InjuryRecords", "HabitTrackers", "HabitLogs", "TransformationJournals",
                "WearableDevices", "FoodItems", "DietPlans", "NutritionLogs", "Leads",
                "LeadActivities", "Referrals", "ReferralPrograms", "Achievements",
                "UserAchievements", "Challenges", "ChallengeParticipants", "Notifications",
                "NotificationTemplates", "Campaigns", "CommunicationLogs", "FeedbackSurveys",
                "FeedbackResponses", "Webhooks", "WebhookDeliveries", "AutomationRules",
                "AutomationLogs", "ScheduledTasks", "FacilityEquipments", "EquipmentMaintenanceLogs",
                "EquipmentBookings", "Lockers", "LockerAssignments", "AccessDevices", "AccessEvents",
                "PayrollConfigs", "PayrollPeriods", "PayrollSlips", "AnalyticsDailys",
                "TrainerAnalyticsDailys", "AiChatSessions", "AiChatMessages", "MlPredictions",
                "PoseLogs", "ApiKeys", "AuditLogs", "AssessmentTemplates", "ClientAssessments",
                "CustomFieldDefinitions", "CustomPages", "ExportJobs", "FeatureFlags",
                "MediaLibraries", "NavigationMenus", "OnboardingSteps", "Plugins", "PricingRules",
                "Ratings", "SearchIndexCaches", "SocialPosts", "SupportTickets",
                "SupportTicketReplies", "Tags", "TenantFeatureOverrides", "TenantPlugins",
                "UiThemes", "VirtualSessions", "PosProducts", "PosOrders", "PosOrderItems",
                "ReferralPrograms", "Permissions"
            };

            foreach (var table in tables)
            {
                migrationBuilder.Sql(
                    $"ALTER TABLE \"{ table }\" ALTER COLUMN \"Id\" SET DEFAULT nextval('global_id_seq');"
                );
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            var tables = new[]
            {
                "Tenants", "Branches", "TenantSettings", "Roles", "Users", "UserSessions",
                "SsoProviders", "Permissions", "MembershipPlans", "GymMemberships",
                "CorporateAccounts", "Invoices", "Payments", "PaymentGateways", "Coupons",
                "CouponRedemptions", "WorkoutTemplates", "WorkoutSections", "WorkoutExercises",
                "WorkoutAssignments", "WorkoutLogs", "WorkoutLogSets", "WorkoutProgressions",
                "WorkoutPlans", "WorkoutPlanWeeks", "WorkoutPlanDays", "WorkoutPlanAssignments",
                "WorkoutPlanBranches", "WorkoutAutomationRules", "WorkoutAutomationLogs",
                "TrainerProfiles", "TrainerClientAssignments", "TrainerAvailabilitySlots",
                "TrainerTimeOffs", "PtSessionTypes", "PtSessions", "ClassTypes", "GymClasses",
                "ClassBookings", "Attendances", "ClientProfiles", "ClientGoals", "HealthMetrics",
                "InjuryRecords", "HabitTrackers", "HabitLogs", "TransformationJournals",
                "WearableDevices", "FoodItems", "DietPlans", "NutritionLogs", "Leads",
                "LeadActivities", "Referrals", "ReferralPrograms", "Achievements",
                "UserAchievements", "Challenges", "ChallengeParticipants", "Notifications",
                "NotificationTemplates", "Campaigns", "CommunicationLogs", "FeedbackSurveys",
                "FeedbackResponses", "Webhooks", "WebhookDeliveries", "AutomationRules",
                "AutomationLogs", "ScheduledTasks", "FacilityEquipments", "EquipmentMaintenanceLogs",
                "EquipmentBookings", "Lockers", "LockerAssignments", "AccessDevices", "AccessEvents",
                "PayrollConfigs", "PayrollPeriods", "PayrollSlips", "AnalyticsDailys",
                "TrainerAnalyticsDailys", "AiChatSessions", "AiChatMessages", "MlPredictions",
                "PoseLogs", "ApiKeys", "AuditLogs", "AssessmentTemplates", "ClientAssessments",
                "CustomFieldDefinitions", "CustomPages", "ExportJobs", "FeatureFlags",
                "MediaLibraries", "NavigationMenus", "OnboardingSteps", "Plugins", "PricingRules",
                "Ratings", "SearchIndexCaches", "SocialPosts", "SupportTickets",
                "SupportTicketReplies", "Tags", "TenantFeatureOverrides", "TenantPlugins",
                "UiThemes", "VirtualSessions", "PosProducts", "PosOrders", "PosOrderItems"
            };

            foreach (var table in tables)
            {
                migrationBuilder.Sql(
                    $"ALTER TABLE \"{ table }\" ALTER COLUMN \"Id\" DROP DEFAULT;"
                );
            }

            migrationBuilder.Sql("DROP SEQUENCE IF EXISTS global_id_seq;");
        }
    }
}
