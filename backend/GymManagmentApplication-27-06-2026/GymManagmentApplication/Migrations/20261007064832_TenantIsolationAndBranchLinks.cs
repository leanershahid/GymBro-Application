using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class TenantIsolationAndBranchLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Roles_TenantId",
                table: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_Slug",
                table: "Exercises");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_TenantId",
                table: "Exercises");

            migrationBuilder.DropIndex(
                name: "IX_Branches_TenantId",
                table: "Branches");

            migrationBuilder.AddColumn<decimal>(
                name: "TenantId",
                table: "WorkoutPlanAssignments",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TenantId",
                table: "WorkoutLogs",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TenantId",
                table: "TrainerProfiles",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TenantId",
                table: "TrainerClientAssignments",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "UserId",
                table: "OnboardingSteps",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TenantId",
                table: "ClassBookings",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            // ── Data repair / backfill before the new indexes and FKs are created ──────────
            migrationBuilder.Sql(@"
-- Trainers were created with Users.TenantId = their BranchId. Move them to the branch's real tenant.
UPDATE ""Users"" u SET ""TenantId"" = b.""TenantId""
FROM ""TrainerProfiles"" tp JOIN ""Branches"" b ON b.""Id"" = tp.""BranchId""
WHERE tp.""UserId"" = u.""Id"" AND u.""TenantId"" <> b.""TenantId"";

-- New tenant columns: derive from the owning user / branch / plan / class.
UPDATE ""TrainerProfiles"" tp SET ""TenantId"" = COALESCE(
    (SELECT u.""TenantId"" FROM ""Users"" u WHERE u.""Id"" = tp.""UserId""),
    (SELECT b.""TenantId"" FROM ""Branches"" b WHERE b.""Id"" = tp.""BranchId""),
    (SELECT MIN(""Id"") FROM ""Tenants""));

UPDATE ""TrainerClientAssignments"" a SET ""TenantId"" = b.""TenantId""
FROM ""Branches"" b WHERE b.""Id"" = a.""BranchId"";

UPDATE ""WorkoutLogs"" l SET ""TenantId"" = u.""TenantId""
FROM ""Users"" u WHERE u.""Id"" = l.""ClientId"";

UPDATE ""WorkoutPlanAssignments"" a SET ""TenantId"" = p.""TenantId""
FROM ""WorkoutPlans"" p WHERE p.""Id"" = a.""PlanId"";

UPDATE ""ClassBookings"" c SET ""TenantId"" = g.""TenantId""
FROM ""GymClasses"" g WHERE g.""Id"" = c.""ClassId"";

UPDATE ""TrainerClientAssignments"" SET ""TenantId"" = (SELECT MIN(""Id"") FROM ""Tenants"") WHERE ""TenantId"" = 0;
UPDATE ""WorkoutLogs""              SET ""TenantId"" = (SELECT MIN(""Id"") FROM ""Tenants"") WHERE ""TenantId"" = 0;
UPDATE ""WorkoutPlanAssignments""   SET ""TenantId"" = (SELECT MIN(""Id"") FROM ""Tenants"") WHERE ""TenantId"" = 0;
UPDATE ""ClassBookings""            SET ""TenantId"" = (SELECT MIN(""Id"") FROM ""Tenants"") WHERE ""TenantId"" = 0;

-- Onboarding steps used TenantId to hold the member id. Split it into UserId + the member's tenant.
UPDATE ""OnboardingSteps"" s SET ""UserId"" = s.""TenantId"", ""TenantId"" = u.""TenantId""
FROM ""Users"" u WHERE u.""Id"" = s.""TenantId"" AND s.""UserId"" IS NULL;
DELETE FROM ""OnboardingSteps"" a USING ""OnboardingSteps"" b
WHERE a.""UserId"" = b.""UserId"" AND a.""StepKey"" = b.""StepKey"" AND a.""Id"" > b.""Id"";

-- Orphaned references would block the new FKs.
UPDATE ""AuditLogs""      SET ""TenantId"" = NULL WHERE ""TenantId"" IS NOT NULL AND ""TenantId"" NOT IN (SELECT ""Id"" FROM ""Tenants"");
UPDATE ""ScheduledTasks"" SET ""TenantId"" = NULL WHERE ""TenantId"" IS NOT NULL AND ""TenantId"" NOT IN (SELECT ""Id"" FROM ""Tenants"");
UPDATE ""FoodItems""      SET ""TenantId"" = NULL WHERE ""TenantId"" IS NOT NULL AND ""TenantId"" NOT IN (SELECT ""Id"" FROM ""Tenants"");
UPDATE ""Equipment""      SET ""TenantId"" = NULL WHERE ""TenantId"" IS NOT NULL AND ""TenantId"" NOT IN (SELECT ""Id"" FROM ""Tenants"");
DELETE FROM ""SearchIndexCaches"" WHERE ""TenantId"" NOT IN (SELECT ""Id"" FROM ""Tenants"");
UPDATE ""PtSessions""      SET ""BranchId"" = NULL WHERE ""BranchId"" IS NOT NULL AND ""BranchId"" NOT IN (SELECT ""Id"" FROM ""Branches"");
UPDATE ""WorkoutLogs""     SET ""BranchId"" = NULL WHERE ""BranchId"" IS NOT NULL AND ""BranchId"" NOT IN (SELECT ""Id"" FROM ""Branches"");
UPDATE ""AnalyticsDailys"" SET ""BranchId"" = NULL WHERE ""BranchId"" IS NOT NULL AND ""BranchId"" NOT IN (SELECT ""Id"" FROM ""Branches"");
UPDATE ""PosOrders""       SET ""BranchId"" = NULL WHERE ""BranchId"" IS NOT NULL AND ""BranchId"" NOT IN (SELECT ""Id"" FROM ""Branches"");
UPDATE ""PosProducts""     SET ""BranchId"" = NULL WHERE ""BranchId"" IS NOT NULL AND ""BranchId"" NOT IN (SELECT ""Id"" FROM ""Branches"");

-- New per-tenant unique indexes: disambiguate any existing duplicates.
UPDATE ""Branches"" b SET ""Code"" = b.""Code"" || '-' || b.""Id""
WHERE EXISTS (SELECT 1 FROM ""Branches"" o WHERE o.""TenantId"" = b.""TenantId"" AND o.""Code"" = b.""Code"" AND o.""Id"" < b.""Id"");
UPDATE ""Roles"" r SET ""Slug"" = r.""Slug"" || '-' || r.""Id""
WHERE EXISTS (SELECT 1 FROM ""Roles"" o WHERE o.""TenantId"" = r.""TenantId"" AND o.""Slug"" = r.""Slug"" AND o.""Id"" < r.""Id"");
");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutPlanAssignments_TenantId",
                table: "WorkoutPlanAssignments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutLogs_BranchId",
                table: "WorkoutLogs",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutLogs_TenantId",
                table: "WorkoutLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainerProfiles_TenantId",
                table: "TrainerProfiles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainerClientAssignments_TenantId",
                table: "TrainerClientAssignments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SearchIndexCaches_TenantId",
                table: "SearchIndexCaches",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledTasks_TenantId",
                table: "ScheduledTasks",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_TenantId_Slug",
                table: "Roles",
                columns: new[] { "TenantId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PtSessions_BranchId",
                table: "PtSessions",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_PosProducts_BranchId",
                table: "PosProducts",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_PosOrders_BranchId",
                table: "PosOrders",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_OnboardingSteps_UserId_StepKey",
                table: "OnboardingSteps",
                columns: new[] { "UserId", "StepKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FoodItems_TenantId",
                table: "FoodItems",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_TenantId_Slug",
                table: "Exercises",
                columns: new[] { "TenantId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_TenantId",
                table: "Equipment",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ClassBookings_TenantId",
                table: "ClassBookings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_TenantId_Code",
                table: "Branches",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TenantId",
                table: "AuditLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsDailys_BranchId",
                table: "AnalyticsDailys",
                column: "BranchId");

            migrationBuilder.AddForeignKey(
                name: "FK_AnalyticsDailys_Branches_BranchId",
                table: "AnalyticsDailys",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Tenants_TenantId",
                table: "AuditLogs",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ClassBookings_Tenants_TenantId",
                table: "ClassBookings",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Equipment_Tenants_TenantId",
                table: "Equipment",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_FoodItems_Tenants_TenantId",
                table: "FoodItems",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OnboardingSteps_Users_UserId",
                table: "OnboardingSteps",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PosOrders_Branches_BranchId",
                table: "PosOrders",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_PosProducts_Branches_BranchId",
                table: "PosProducts",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_PtSessions_Branches_BranchId",
                table: "PtSessions",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduledTasks_Tenants_TenantId",
                table: "ScheduledTasks",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SearchIndexCaches_Tenants_TenantId",
                table: "SearchIndexCaches",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainerClientAssignments_Tenants_TenantId",
                table: "TrainerClientAssignments",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TrainerProfiles_Tenants_TenantId",
                table: "TrainerProfiles",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutLogs_Branches_BranchId",
                table: "WorkoutLogs",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutLogs_Tenants_TenantId",
                table: "WorkoutLogs",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutPlanAssignments_Tenants_TenantId",
                table: "WorkoutPlanAssignments",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AnalyticsDailys_Branches_BranchId",
                table: "AnalyticsDailys");

            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Tenants_TenantId",
                table: "AuditLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ClassBookings_Tenants_TenantId",
                table: "ClassBookings");

            migrationBuilder.DropForeignKey(
                name: "FK_Equipment_Tenants_TenantId",
                table: "Equipment");

            migrationBuilder.DropForeignKey(
                name: "FK_FoodItems_Tenants_TenantId",
                table: "FoodItems");

            migrationBuilder.DropForeignKey(
                name: "FK_OnboardingSteps_Users_UserId",
                table: "OnboardingSteps");

            migrationBuilder.DropForeignKey(
                name: "FK_PosOrders_Branches_BranchId",
                table: "PosOrders");

            migrationBuilder.DropForeignKey(
                name: "FK_PosProducts_Branches_BranchId",
                table: "PosProducts");

            migrationBuilder.DropForeignKey(
                name: "FK_PtSessions_Branches_BranchId",
                table: "PtSessions");

            migrationBuilder.DropForeignKey(
                name: "FK_ScheduledTasks_Tenants_TenantId",
                table: "ScheduledTasks");

            migrationBuilder.DropForeignKey(
                name: "FK_SearchIndexCaches_Tenants_TenantId",
                table: "SearchIndexCaches");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainerClientAssignments_Tenants_TenantId",
                table: "TrainerClientAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_TrainerProfiles_Tenants_TenantId",
                table: "TrainerProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutLogs_Branches_BranchId",
                table: "WorkoutLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutLogs_Tenants_TenantId",
                table: "WorkoutLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutPlanAssignments_Tenants_TenantId",
                table: "WorkoutPlanAssignments");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutPlanAssignments_TenantId",
                table: "WorkoutPlanAssignments");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutLogs_BranchId",
                table: "WorkoutLogs");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutLogs_TenantId",
                table: "WorkoutLogs");

            migrationBuilder.DropIndex(
                name: "IX_TrainerProfiles_TenantId",
                table: "TrainerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_TrainerClientAssignments_TenantId",
                table: "TrainerClientAssignments");

            migrationBuilder.DropIndex(
                name: "IX_SearchIndexCaches_TenantId",
                table: "SearchIndexCaches");

            migrationBuilder.DropIndex(
                name: "IX_ScheduledTasks_TenantId",
                table: "ScheduledTasks");

            migrationBuilder.DropIndex(
                name: "IX_Roles_TenantId_Slug",
                table: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_PtSessions_BranchId",
                table: "PtSessions");

            migrationBuilder.DropIndex(
                name: "IX_PosProducts_BranchId",
                table: "PosProducts");

            migrationBuilder.DropIndex(
                name: "IX_PosOrders_BranchId",
                table: "PosOrders");

            migrationBuilder.DropIndex(
                name: "IX_OnboardingSteps_UserId_StepKey",
                table: "OnboardingSteps");

            migrationBuilder.DropIndex(
                name: "IX_FoodItems_TenantId",
                table: "FoodItems");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_TenantId_Slug",
                table: "Exercises");

            migrationBuilder.DropIndex(
                name: "IX_Equipment_TenantId",
                table: "Equipment");

            migrationBuilder.DropIndex(
                name: "IX_ClassBookings_TenantId",
                table: "ClassBookings");

            migrationBuilder.DropIndex(
                name: "IX_Branches_TenantId_Code",
                table: "Branches");

            migrationBuilder.DropIndex(
                name: "IX_AuditLogs_TenantId",
                table: "AuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_AnalyticsDailys_BranchId",
                table: "AnalyticsDailys");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "WorkoutPlanAssignments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "WorkoutLogs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "TrainerProfiles");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "TrainerClientAssignments");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "OnboardingSteps");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ClassBookings");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_TenantId",
                table: "Roles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_Slug",
                table: "Exercises",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_TenantId",
                table: "Exercises",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_TenantId",
                table: "Branches",
                column: "TenantId");
        }
    }
}
