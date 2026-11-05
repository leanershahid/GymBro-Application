using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class ArchitectureAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CommunicationLogs_Campaigns_CampaignId",
                table: "CommunicationLogs");

            migrationBuilder.DropTable(
                name: "AiChatMessages");

            migrationBuilder.DropTable(
                name: "AnalyticsDailys");

            migrationBuilder.DropTable(
                name: "ApiKeys");

            migrationBuilder.DropTable(
                name: "AutomationLogs");

            migrationBuilder.DropTable(
                name: "Campaigns");

            migrationBuilder.DropTable(
                name: "ClientGoals");

            migrationBuilder.DropTable(
                name: "CustomFieldDefinitions");

            migrationBuilder.DropTable(
                name: "CustomPages");

            migrationBuilder.DropTable(
                name: "EquipmentBookings");

            migrationBuilder.DropTable(
                name: "EquipmentMaintenanceLogs");

            migrationBuilder.DropTable(
                name: "ExportJobs");

            migrationBuilder.DropTable(
                name: "FeatureFlags");

            migrationBuilder.DropTable(
                name: "FeedbackResponses");

            migrationBuilder.DropTable(
                name: "InjuryRecords");

            migrationBuilder.DropTable(
                name: "LockerAssignments");

            migrationBuilder.DropTable(
                name: "MlPredictions");

            migrationBuilder.DropTable(
                name: "NavigationMenus");

            migrationBuilder.DropTable(
                name: "NotificationTemplates");

            migrationBuilder.DropTable(
                name: "NutritionLogs");

            migrationBuilder.DropTable(
                name: "PayrollConfigs");

            migrationBuilder.DropTable(
                name: "PayrollSlips");

            migrationBuilder.DropTable(
                name: "PoseLogs");

            migrationBuilder.DropTable(
                name: "Referrals");

            migrationBuilder.DropTable(
                name: "ScheduledTasks");

            migrationBuilder.DropTable(
                name: "SearchIndexCaches");

            migrationBuilder.DropTable(
                name: "SupportTicketReplies");

            migrationBuilder.DropTable(
                name: "TenantFeatureOverrides");

            migrationBuilder.DropTable(
                name: "TenantPlugins");

            migrationBuilder.DropTable(
                name: "TrainerAnalyticsDailys");

            migrationBuilder.DropTable(
                name: "UiThemes");

            migrationBuilder.DropTable(
                name: "UserAchievements");

            migrationBuilder.DropTable(
                name: "VirtualSessions");

            migrationBuilder.DropTable(
                name: "WearableDevices");

            migrationBuilder.DropTable(
                name: "WebhookDeliveries");

            migrationBuilder.DropTable(
                name: "WorkoutLogSets");

            migrationBuilder.DropTable(
                name: "WorkoutProgressions");

            migrationBuilder.DropTable(
                name: "AiChatSessions");

            migrationBuilder.DropTable(
                name: "AutomationRules");

            migrationBuilder.DropTable(
                name: "FacilityEquipments");

            migrationBuilder.DropTable(
                name: "FeedbackSurveys");

            migrationBuilder.DropTable(
                name: "Lockers");

            migrationBuilder.DropTable(
                name: "DietPlans");

            migrationBuilder.DropTable(
                name: "FoodItems");

            migrationBuilder.DropTable(
                name: "PayrollPeriods");

            migrationBuilder.DropTable(
                name: "ReferralPrograms");

            migrationBuilder.DropTable(
                name: "SupportTickets");

            migrationBuilder.DropTable(
                name: "Plugins");

            migrationBuilder.DropTable(
                name: "Achievements");

            migrationBuilder.DropTable(
                name: "Webhooks");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_UserId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_GymMemberships_TenantId",
                table: "GymMemberships");

            migrationBuilder.DropIndex(
                name: "IX_GymClasses_TenantId",
                table: "GymClasses");

            migrationBuilder.DropIndex(
                name: "IX_CommunicationLogs_CampaignId",
                table: "CommunicationLogs");

            migrationBuilder.DropIndex(
                name: "IX_CommunicationLogs_TenantId",
                table: "CommunicationLogs");

            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "Payments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Attempts",
                table: "CommunicationLogs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "TenantCounters",
                columns: table => new
                {
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Value = table.Column<long>(type: "bigint", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantCounters", x => new { x.TenantId, x.Key });
                });

            migrationBuilder.CreateTable(
                name: "WorkoutBookmarks",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    WorkoutTemplateId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutBookmarks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutBookmarks_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutBookmarks_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkoutBookmarks_WorkoutTemplates_WorkoutTemplateId",
                        column: x => x.WorkoutTemplateId,
                        principalTable: "WorkoutTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Unique only when existing data allows it: duplicate gateway refs (from the old double-record bug)
            // must not fail the deploy. If any exist, a plain index is created and a NOTICE is raised;
            // clean the duplicates and recreate it as unique.
            migrationBuilder.Sql("""
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
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId_IdempotencyKey",
                table: "Payments",
                columns: new[] { "TenantId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_ReadAt",
                table: "Notifications",
                columns: new[] { "UserId", "ReadAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_UserId_Status",
                table: "Invoices",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_GymMemberships_TenantId_Status_EndsAt",
                table: "GymMemberships",
                columns: new[] { "TenantId", "Status", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_GymClasses_TenantId_StartsAt",
                table: "GymClasses",
                columns: new[] { "TenantId", "StartsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CommunicationLogs_Status_Channel_CreatedAt",
                table: "CommunicationLogs",
                columns: new[] { "Status", "Channel", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CommunicationLogs_TenantId_ProviderRef",
                table: "CommunicationLogs",
                columns: new[] { "TenantId", "ProviderRef" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutBookmarks_TenantId",
                table: "WorkoutBookmarks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutBookmarks_UserId_WorkoutTemplateId",
                table: "WorkoutBookmarks",
                columns: new[] { "UserId", "WorkoutTemplateId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutBookmarks_WorkoutTemplateId",
                table: "WorkoutBookmarks",
                column: "WorkoutTemplateId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TenantCounters");

            migrationBuilder.DropTable(
                name: "WorkoutBookmarks");

            migrationBuilder.DropIndex(
                name: "IX_Payments_TenantId_GatewayRef",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_TenantId_IdempotencyKey",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_ReadAt",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_UserId_Status",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_GymMemberships_TenantId_Status_EndsAt",
                table: "GymMemberships");

            migrationBuilder.DropIndex(
                name: "IX_GymClasses_TenantId_StartsAt",
                table: "GymClasses");

            migrationBuilder.DropIndex(
                name: "IX_CommunicationLogs_Status_Channel_CreatedAt",
                table: "CommunicationLogs");

            migrationBuilder.DropIndex(
                name: "IX_CommunicationLogs_TenantId_ProviderRef",
                table: "CommunicationLogs");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Attempts",
                table: "CommunicationLogs");

            migrationBuilder.CreateTable(
                name: "Achievements",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Criteria = table.Column<string>(type: "jsonb", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    IconUrl = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Achievements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Achievements_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AiChatSessions",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Context = table.Column<string>(type: "jsonb", nullable: true),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SessionKey = table.Column<string>(type: "text", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiChatSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiChatSessions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AiChatSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AnalyticsDailys",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AvgSessionMin = table.Column<int>(type: "integer", nullable: true),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ChurnedMembers = table.Column<int>(type: "integer", nullable: false),
                    ClassesHeld = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LeadsConverted = table.Column<int>(type: "integer", nullable: false),
                    LeadsCreated = table.Column<int>(type: "integer", nullable: false),
                    NewMembers = table.Column<int>(type: "integer", nullable: false),
                    ReportDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Revenue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalCheckins = table.Column<long>(type: "bigint", nullable: false),
                    UniqueMembers = table.Column<long>(type: "bigint", nullable: false),
                    WorkoutsDone = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnalyticsDailys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnalyticsDailys_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AnalyticsDailys_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ApiKeys",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    KeyHash = table.Column<string>(type: "text", nullable: false),
                    KeyPrefix = table.Column<string>(type: "text", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    RateLimit = table.Column<long>(type: "bigint", nullable: false),
                    Scopes = table.Column<string>(type: "jsonb", nullable: true),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiKeys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApiKeys_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AutomationRules",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Actions = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastRunAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    RunCount = table.Column<long>(type: "bigint", nullable: false),
                    TriggerConditions = table.Column<string>(type: "jsonb", nullable: true),
                    TriggerEvent = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutomationRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AutomationRules_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Campaigns",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Audience = table.Column<string>(type: "jsonb", nullable: true),
                    ClickCount = table.Column<long>(type: "bigint", nullable: false),
                    Content = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    OpenCount = table.Column<long>(type: "bigint", nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SentCount = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Campaigns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Campaigns_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientGoals",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CurrentValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TargetDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TargetValue = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Unit = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientGoals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientGoals_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientGoals_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomFieldDefinitions",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EntityType = table.Column<string>(type: "text", nullable: false),
                    FieldKey = table.Column<string>(type: "text", nullable: false),
                    FieldType = table.Column<int>(type: "integer", nullable: false),
                    IsRequired = table.Column<bool>(type: "boolean", nullable: false),
                    Label = table.Column<string>(type: "text", nullable: false),
                    Options = table.Column<string>(type: "jsonb", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomFieldDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomFieldDefinitions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomPages",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    Layout = table.Column<string>(type: "jsonb", nullable: true),
                    MetaDesc = table.Column<string>(type: "text", nullable: true),
                    MetaTitle = table.Column<string>(type: "text", nullable: true),
                    Slug = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomPages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomPages_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DietPlans",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CaloriesTarget = table.Column<int>(type: "integer", nullable: true),
                    CarbsG = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    FatG = table.Column<int>(type: "integer", nullable: true),
                    Goal = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsAiGenerated = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    ProteinG = table.Column<int>(type: "integer", nullable: true),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DietPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DietPlans_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DietPlans_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_DietPlans_Users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExportJobs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ErrorMsg = table.Column<string>(type: "text", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: true),
                    FileUrl = table.Column<string>(type: "text", nullable: true),
                    Filters = table.Column<string>(type: "jsonb", nullable: true),
                    ReportType = table.Column<string>(type: "text", nullable: false),
                    RequestedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RowCount = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExportJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExportJobs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FacilityEquipments",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EquipmentId = table.Column<int>(type: "integer", nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IotDeviceId = table.Column<string>(type: "text", nullable: true),
                    LastServiced = table.Column<DateOnly>(type: "date", nullable: true),
                    LocationTag = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    NextService = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    PurchaseDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SerialNumber = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WarrantyExpiry = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityEquipments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacilityEquipments_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FacilityEquipments_Equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_FacilityEquipments_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FeatureFlags",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    FeatureKey = table.Column<string>(type: "text", nullable: false),
                    Label = table.Column<string>(type: "text", nullable: true),
                    Plans = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeatureFlags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackSurveys",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Questions = table.Column<string>(type: "jsonb", nullable: false),
                    TriggerEvent = table.Column<string>(type: "text", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackSurveys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackSurveys_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FoodItems",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Barcode = table.Column<string>(type: "text", nullable: true),
                    Brand = table.Column<string>(type: "text", nullable: true),
                    Calories = table.Column<int>(type: "integer", nullable: true),
                    CarbsG = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    FatG = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    FiberG = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    ProteinG = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    ServingG = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FoodItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FoodItems_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InjuryRecords",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ReporterId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    AiDetected = table.Column<bool>(type: "boolean", nullable: false),
                    BodyPart = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InjuryType = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    OccurredAt = table.Column<DateOnly>(type: "date", nullable: true),
                    RecoveredAt = table.Column<DateOnly>(type: "date", nullable: true),
                    ReportedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Restrictions = table.Column<string>(type: "jsonb", nullable: true),
                    Severity = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InjuryRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InjuryRecords_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InjuryRecords_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InjuryRecords_Users_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Lockers",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Number = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Zone = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lockers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Lockers_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Lockers_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MlPredictions",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Confidence = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    EntityId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EntityType = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FeaturesUsed = table.Column<string>(type: "jsonb", nullable: true),
                    ModelType = table.Column<string>(type: "text", nullable: false),
                    PredictedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Score = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MlPredictions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MlPredictions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NavigationMenus",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Items = table.Column<string>(type: "jsonb", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    RoleIds = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NavigationMenus", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NavigationMenus_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NotificationTemplates",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Body = table.Column<string>(type: "text", nullable: false),
                    Channel = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EventType = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: true),
                    Variables = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationTemplates_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PayrollConfigs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BaseSalary = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CommissionRules = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Currency = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    PayCycle = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollConfigs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayrollConfigs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PayrollPeriods",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PeriodEnd = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodStart = table.Column<DateOnly>(type: "date", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollPeriods", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollPeriods_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Plugins",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Author = table.Column<string>(type: "text", nullable: true),
                    ConfigSchema = table.Column<string>(type: "jsonb", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    MinPlan = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Slug = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plugins", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PoseLogs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ExerciseId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    LogId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CapturedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Corrections = table.Column<string>(type: "jsonb", nullable: true),
                    Keypoints = table.Column<string>(type: "jsonb", nullable: true),
                    Score = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PoseLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PoseLogs_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PoseLogs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PoseLogs_WorkoutLogs_LogId",
                        column: x => x.LogId,
                        principalTable: "WorkoutLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReferralPrograms",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    MaxUses = table.Column<long>(type: "bigint", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    RefereeReward = table.Column<string>(type: "jsonb", nullable: true),
                    ReferrerReward = table.Column<string>(type: "jsonb", nullable: true),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UsesCount = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReferralPrograms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReferralPrograms_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScheduledTasks",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Attempts = table.Column<byte>(type: "smallint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastError = table.Column<string>(type: "text", nullable: true),
                    Payload = table.Column<string>(type: "jsonb", nullable: true),
                    RunAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TaskType = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledTasks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduledTasks_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SearchIndexCaches",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Embedding = table.Column<string>(type: "jsonb", nullable: true),
                    EntityId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EntityType = table.Column<string>(type: "text", nullable: false),
                    SearchText = table.Column<string>(type: "text", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SearchIndexCaches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SearchIndexCaches_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SupportTickets",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AssignedTo = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AiRouted = table.Column<bool>(type: "boolean", nullable: false),
                    Category = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Subject = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportTickets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportTickets_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SupportTickets_Users_AssignedTo",
                        column: x => x.AssignedTo,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SupportTickets_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TenantFeatureOverrides",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    FeatureKey = table.Column<string>(type: "text", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ValidUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantFeatureOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantFeatureOverrides_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrainerAnalyticsDailys",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TrainerId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AvgRating = table.Column<decimal>(type: "numeric(10,4)", precision: 10, scale: 4, nullable: true),
                    ClientsTrained = table.Column<int>(type: "integer", nullable: false),
                    ReportDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RevenueGenerated = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SessionsDone = table.Column<int>(type: "integer", nullable: false),
                    WorkoutsCreated = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainerAnalyticsDailys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainerAnalyticsDailys_TrainerProfiles_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "TrainerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UiThemes",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CustomCss = table.Column<string>(type: "text", nullable: true),
                    FaviconUrl = table.Column<string>(type: "text", nullable: true),
                    FontBody = table.Column<string>(type: "text", nullable: true),
                    FontHeading = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LayoutConfig = table.Column<string>(type: "jsonb", nullable: true),
                    LogoUrl = table.Column<string>(type: "text", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    PrimaryColor = table.Column<string>(type: "text", nullable: true),
                    SecondaryColor = table.Column<string>(type: "text", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UiThemes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UiThemes_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VirtualSessions",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PtSessionId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TrainerId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MeetingId = table.Column<string>(type: "text", nullable: true),
                    MeetingUrl = table.Column<string>(type: "text", nullable: true),
                    Passcode = table.Column<string>(type: "text", nullable: true),
                    Provider = table.Column<int>(type: "integer", nullable: false),
                    RecordingUrl = table.Column<string>(type: "text", nullable: true),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VirtualSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VirtualSessions_PtSessions_PtSessionId",
                        column: x => x.PtSessionId,
                        principalTable: "PtSessions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_VirtualSessions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VirtualSessions_TrainerProfiles_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "TrainerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VirtualSessions_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WearableDevices",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AccessTokenEnc = table.Column<string>(type: "text", nullable: true),
                    DeviceName = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Provider = table.Column<string>(type: "text", nullable: false),
                    RefreshTokenEnc = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    TokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WearableDevices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WearableDevices_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WearableDevices_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Webhooks",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Events = table.Column<string>(type: "jsonb", nullable: false),
                    FailureCount = table.Column<byte>(type: "smallint", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastFiredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SecretHash = table.Column<string>(type: "text", nullable: true),
                    Url = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Webhooks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Webhooks_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutLogSets",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ExerciseId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    LogId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    DistanceM = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    DurationSec = table.Column<short>(type: "smallint", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Reps = table.Column<int>(type: "integer", nullable: true),
                    Rpe = table.Column<byte>(type: "smallint", nullable: true),
                    SetNo = table.Column<byte>(type: "smallint", nullable: false),
                    WeightKg = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutLogSets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutLogSets_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WorkoutLogSets_WorkoutLogs_LogId",
                        column: x => x.LogId,
                        principalTable: "WorkoutLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutProgressions",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    NextTemplate = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TemplateId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Condition = table.Column<string>(type: "jsonb", nullable: false),
                    SortOrder = table.Column<byte>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutProgressions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutProgressions_WorkoutTemplates_NextTemplate",
                        column: x => x.NextTemplate,
                        principalTable: "WorkoutTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutProgressions_WorkoutTemplates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "WorkoutTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserAchievements",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AchievementId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EarnedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAchievements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserAchievements_Achievements_AchievementId",
                        column: x => x.AchievementId,
                        principalTable: "Achievements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserAchievements_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserAchievements_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AiChatMessages",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    SessionId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    Tokens = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AiChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AiChatMessages_AiChatSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "AiChatSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AutomationLogs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RuleId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EntityId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    EntityType = table.Column<string>(type: "text", nullable: true),
                    ExecutedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Result = table.Column<string>(type: "jsonb", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AutomationLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AutomationLogs_AutomationRules_RuleId",
                        column: x => x.RuleId,
                        principalTable: "AutomationRules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EquipmentBookings",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EquipmentId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EquipmentBookings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EquipmentBookings_FacilityEquipments_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "FacilityEquipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EquipmentBookings_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EquipmentBookings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EquipmentMaintenanceLogs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    EquipmentId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PerformerId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    NextDue = table.Column<DateOnly>(type: "date", nullable: true),
                    PerformedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PerformedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EquipmentMaintenanceLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EquipmentMaintenanceLogs_FacilityEquipments_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "FacilityEquipments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EquipmentMaintenanceLogs_Users_PerformerId",
                        column: x => x.PerformerId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "FeedbackResponses",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    SurveyId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Responses = table.Column<string>(type: "jsonb", nullable: true),
                    Score = table.Column<short>(type: "smallint", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackResponses_FeedbackSurveys_SurveyId",
                        column: x => x.SurveyId,
                        principalTable: "FeedbackSurveys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeedbackResponses_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FeedbackResponses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NutritionLogs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    DietPlanId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    FoodId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Calories = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FoodName = table.Column<string>(type: "text", nullable: true),
                    LogDate = table.Column<DateOnly>(type: "date", nullable: false),
                    MealType = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    QuantityG = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NutritionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NutritionLogs_DietPlans_DietPlanId",
                        column: x => x.DietPlanId,
                        principalTable: "DietPlans",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_NutritionLogs_FoodItems_FoodId",
                        column: x => x.FoodId,
                        principalTable: "FoodItems",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_NutritionLogs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_NutritionLogs_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LockerAssignments",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    LockerId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    ReleasedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LockerAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LockerAssignments_Lockers_LockerId",
                        column: x => x.LockerId,
                        principalTable: "Lockers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LockerAssignments_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerAssignments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PayrollSlips",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PeriodId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BaseSalary = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Bonuses = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Breakdown = table.Column<string>(type: "jsonb", nullable: true),
                    Commission = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Currency = table.Column<string>(type: "text", nullable: false),
                    Deductions = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetPay = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollSlips", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollSlips_PayrollPeriods_PeriodId",
                        column: x => x.PeriodId,
                        principalTable: "PayrollPeriods",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PayrollSlips_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayrollSlips_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantPlugins",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PluginId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Config = table.Column<string>(type: "jsonb", nullable: true),
                    InstalledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantPlugins", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantPlugins_Plugins_PluginId",
                        column: x => x.PluginId,
                        principalTable: "Plugins",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TenantPlugins_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Referrals",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ProgramId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RefereeId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ReferrerId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    ConvertedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RefereeEmail = table.Column<string>(type: "text", nullable: true),
                    RewardedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Referrals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Referrals_ReferralPrograms_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "ReferralPrograms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Referrals_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Referrals_Users_RefereeId",
                        column: x => x.RefereeId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_Referrals_Users_ReferrerId",
                        column: x => x.ReferrerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SupportTicketReplies",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TicketId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Attachments = table.Column<string>(type: "jsonb", nullable: true),
                    Body = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportTicketReplies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportTicketReplies_SupportTickets_TicketId",
                        column: x => x.TicketId,
                        principalTable: "SupportTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SupportTicketReplies_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WebhookDeliveries",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    WebhookId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Attempt = table.Column<byte>(type: "smallint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeliveredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EventType = table.Column<string>(type: "text", nullable: false),
                    Payload = table.Column<string>(type: "jsonb", nullable: true),
                    ResponseBody = table.Column<string>(type: "text", nullable: true),
                    ResponseCode = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebhookDeliveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WebhookDeliveries_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WebhookDeliveries_Webhooks_WebhookId",
                        column: x => x.WebhookId,
                        principalTable: "Webhooks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_UserId",
                table: "Invoices",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_GymMemberships_TenantId",
                table: "GymMemberships",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_GymClasses_TenantId",
                table: "GymClasses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CommunicationLogs_CampaignId",
                table: "CommunicationLogs",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_CommunicationLogs_TenantId",
                table: "CommunicationLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Achievements_TenantId",
                table: "Achievements",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AiChatMessages_SessionId",
                table: "AiChatMessages",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_AiChatSessions_TenantId",
                table: "AiChatSessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AiChatSessions_UserId",
                table: "AiChatSessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsDailys_BranchId",
                table: "AnalyticsDailys",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsDailys_TenantId",
                table: "AnalyticsDailys",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeys_TenantId",
                table: "ApiKeys",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationLogs_RuleId",
                table: "AutomationLogs",
                column: "RuleId");

            migrationBuilder.CreateIndex(
                name: "IX_AutomationRules_TenantId",
                table: "AutomationRules",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Campaigns_TenantId",
                table: "Campaigns",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGoals_ClientId",
                table: "ClientGoals",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientGoals_TenantId",
                table: "ClientGoals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomFieldDefinitions_TenantId",
                table: "CustomFieldDefinitions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomPages_TenantId",
                table: "CustomPages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DietPlans_ClientId",
                table: "DietPlans",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_DietPlans_CreatedBy",
                table: "DietPlans",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_DietPlans_TenantId",
                table: "DietPlans",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentBookings_EquipmentId",
                table: "EquipmentBookings",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentBookings_TenantId",
                table: "EquipmentBookings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentBookings_UserId",
                table: "EquipmentBookings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentMaintenanceLogs_EquipmentId",
                table: "EquipmentMaintenanceLogs",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentMaintenanceLogs_PerformerId",
                table: "EquipmentMaintenanceLogs",
                column: "PerformerId");

            migrationBuilder.CreateIndex(
                name: "IX_ExportJobs_TenantId",
                table: "ExportJobs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityEquipments_BranchId",
                table: "FacilityEquipments",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityEquipments_EquipmentId",
                table: "FacilityEquipments",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityEquipments_TenantId",
                table: "FacilityEquipments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackResponses_SurveyId",
                table: "FeedbackResponses",
                column: "SurveyId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackResponses_TenantId",
                table: "FeedbackResponses",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackResponses_UserId",
                table: "FeedbackResponses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackSurveys_TenantId",
                table: "FeedbackSurveys",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FoodItems_TenantId",
                table: "FoodItems",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_InjuryRecords_ClientId",
                table: "InjuryRecords",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_InjuryRecords_ReporterId",
                table: "InjuryRecords",
                column: "ReporterId");

            migrationBuilder.CreateIndex(
                name: "IX_InjuryRecords_TenantId",
                table: "InjuryRecords",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAssignments_LockerId",
                table: "LockerAssignments",
                column: "LockerId");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAssignments_TenantId",
                table: "LockerAssignments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAssignments_UserId",
                table: "LockerAssignments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Lockers_BranchId",
                table: "Lockers",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Lockers_TenantId",
                table: "Lockers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_MlPredictions_TenantId",
                table: "MlPredictions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_NavigationMenus_TenantId",
                table: "NavigationMenus",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationTemplates_TenantId",
                table: "NotificationTemplates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_NutritionLogs_ClientId",
                table: "NutritionLogs",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_NutritionLogs_DietPlanId",
                table: "NutritionLogs",
                column: "DietPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_NutritionLogs_FoodId",
                table: "NutritionLogs",
                column: "FoodId");

            migrationBuilder.CreateIndex(
                name: "IX_NutritionLogs_TenantId",
                table: "NutritionLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollConfigs_TenantId",
                table: "PayrollConfigs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollConfigs_UserId",
                table: "PayrollConfigs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPeriods_TenantId",
                table: "PayrollPeriods",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSlips_PeriodId",
                table: "PayrollSlips",
                column: "PeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSlips_TenantId",
                table: "PayrollSlips",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSlips_UserId",
                table: "PayrollSlips",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PoseLogs_ExerciseId",
                table: "PoseLogs",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_PoseLogs_LogId",
                table: "PoseLogs",
                column: "LogId");

            migrationBuilder.CreateIndex(
                name: "IX_PoseLogs_TenantId",
                table: "PoseLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ReferralPrograms_TenantId",
                table: "ReferralPrograms",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_ProgramId",
                table: "Referrals",
                column: "ProgramId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_RefereeId",
                table: "Referrals",
                column: "RefereeId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_ReferrerId",
                table: "Referrals",
                column: "ReferrerId");

            migrationBuilder.CreateIndex(
                name: "IX_Referrals_TenantId",
                table: "Referrals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledTasks_TenantId",
                table: "ScheduledTasks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SearchIndexCaches_TenantId",
                table: "SearchIndexCaches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportTicketReplies_TicketId",
                table: "SupportTicketReplies",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportTicketReplies_UserId",
                table: "SupportTicketReplies",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportTickets_AssignedTo",
                table: "SupportTickets",
                column: "AssignedTo");

            migrationBuilder.CreateIndex(
                name: "IX_SupportTickets_TenantId",
                table: "SupportTickets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportTickets_UserId",
                table: "SupportTickets",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantFeatureOverrides_TenantId",
                table: "TenantFeatureOverrides",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantPlugins_PluginId",
                table: "TenantPlugins",
                column: "PluginId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantPlugins_TenantId",
                table: "TenantPlugins",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainerAnalyticsDailys_TrainerId",
                table: "TrainerAnalyticsDailys",
                column: "TrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_UiThemes_TenantId",
                table: "UiThemes",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAchievements_AchievementId",
                table: "UserAchievements",
                column: "AchievementId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAchievements_TenantId",
                table: "UserAchievements",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAchievements_UserId",
                table: "UserAchievements",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_VirtualSessions_ClientId",
                table: "VirtualSessions",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_VirtualSessions_PtSessionId",
                table: "VirtualSessions",
                column: "PtSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_VirtualSessions_TenantId",
                table: "VirtualSessions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_VirtualSessions_TrainerId",
                table: "VirtualSessions",
                column: "TrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_WearableDevices_ClientId",
                table: "WearableDevices",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_WearableDevices_TenantId",
                table: "WearableDevices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WebhookDeliveries_TenantId",
                table: "WebhookDeliveries",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WebhookDeliveries_WebhookId",
                table: "WebhookDeliveries",
                column: "WebhookId");

            migrationBuilder.CreateIndex(
                name: "IX_Webhooks_TenantId",
                table: "Webhooks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutLogSets_ExerciseId",
                table: "WorkoutLogSets",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutLogSets_LogId",
                table: "WorkoutLogSets",
                column: "LogId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutProgressions_NextTemplate",
                table: "WorkoutProgressions",
                column: "NextTemplate");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutProgressions_TemplateId",
                table: "WorkoutProgressions",
                column: "TemplateId");

            migrationBuilder.AddForeignKey(
                name: "FK_CommunicationLogs_Campaigns_CampaignId",
                table: "CommunicationLogs",
                column: "CampaignId",
                principalTable: "Campaigns",
                principalColumn: "Id");
        }
    }
}
