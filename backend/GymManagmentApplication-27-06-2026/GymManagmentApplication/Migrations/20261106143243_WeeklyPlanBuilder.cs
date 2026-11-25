using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class WeeklyPlanBuilder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkoutPlans_TenantId",
                table: "WorkoutPlans");

            migrationBuilder.CreateSequence(
                name: "PersonalRecords_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "PlanDayOverrides_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "WorkoutSetLogs_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.AddColumn<decimal>(
                name: "OwnerPlanDayId",
                table: "WorkoutTemplates",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<byte>(
                name: "DaysPerWeekHint",
                table: "WorkoutPlans",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsTemplate",
                table: "WorkoutPlans",
                type: "boolean",
                nullable: false,
                // Existing plans are masters. Migration-only default: the model has none, so EF always
                // writes the value it holds (see PlanBuilderConfigurations).
                defaultValue: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OwnerClientId",
                table: "WorkoutPlans",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SourcePlanId",
                table: "WorkoutPlans",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "WorkoutPlanDays",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "WorkoutPlanDays",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte>(
                name: "DayNumber",
                table: "WorkoutLogs",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PlanAssignmentId",
                table: "WorkoutLogs",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<byte>(
                name: "SessionRpe",
                table: "WorkoutLogs",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<byte>(
                name: "WeekNumber",
                table: "WorkoutLogs",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SetTargets",
                table: "WorkoutExercises",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlanDayOverrides",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PlanAssignmentId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Action = table.Column<int>(type: "integer", nullable: false),
                    MovedToDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlanDayOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlanDayOverrides_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlanDayOverrides_Users_ByUserId",
                        column: x => x.ByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PlanDayOverrides_WorkoutPlanAssignments_PlanAssignmentId",
                        column: x => x.PlanAssignmentId,
                        principalTable: "WorkoutPlanAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkoutSetLogs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    WorkoutLogId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ExerciseId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    WorkoutExerciseId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    SetNo = table.Column<byte>(type: "smallint", nullable: false),
                    SetType = table.Column<int>(type: "integer", nullable: false),
                    Reps = table.Column<int>(type: "integer", nullable: true),
                    WeightKg = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: true),
                    Rpe = table.Column<decimal>(type: "numeric(3,1)", precision: 3, scale: 1, nullable: true),
                    DurationSec = table.Column<int>(type: "integer", nullable: true),
                    DistanceM = table.Column<decimal>(type: "numeric(9,2)", precision: 9, scale: 2, nullable: true),
                    Completed = table.Column<bool>(type: "boolean", nullable: false),
                    PerformedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkoutSetLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkoutSetLogs_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutSetLogs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutSetLogs_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkoutSetLogs_WorkoutExercises_WorkoutExerciseId",
                        column: x => x.WorkoutExerciseId,
                        principalTable: "WorkoutExercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_WorkoutSetLogs_WorkoutLogs_WorkoutLogId",
                        column: x => x.WorkoutLogId,
                        principalTable: "WorkoutLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PersonalRecords",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ExerciseId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Reps = table.Column<int>(type: "integer", nullable: true),
                    WeightKg = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: true),
                    WorkoutSetLogId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    WorkoutLogId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    AchievedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersonalRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PersonalRecords_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PersonalRecords_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PersonalRecords_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PersonalRecords_WorkoutLogs_WorkoutLogId",
                        column: x => x.WorkoutLogId,
                        principalTable: "WorkoutLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PersonalRecords_WorkoutSetLogs_WorkoutSetLogId",
                        column: x => x.WorkoutSetLogId,
                        principalTable: "WorkoutSetLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutTemplates_OwnerPlanDayId",
                table: "WorkoutTemplates",
                column: "OwnerPlanDayId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutPlans_OwnerClientId",
                table: "WorkoutPlans",
                column: "OwnerClientId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutPlans_SourcePlanId",
                table: "WorkoutPlans",
                column: "SourcePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutPlans_TenantId_IsTemplate",
                table: "WorkoutPlans",
                columns: new[] { "TenantId", "IsTemplate" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutLogs_PlanAssignmentId_WeekNumber_DayNumber",
                table: "WorkoutLogs",
                columns: new[] { "PlanAssignmentId", "WeekNumber", "DayNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_PersonalRecords_ClientId_ExerciseId_Type",
                table: "PersonalRecords",
                columns: new[] { "ClientId", "ExerciseId", "Type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PersonalRecords_ExerciseId",
                table: "PersonalRecords",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_PersonalRecords_TenantId",
                table: "PersonalRecords",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PersonalRecords_WorkoutLogId",
                table: "PersonalRecords",
                column: "WorkoutLogId");

            migrationBuilder.CreateIndex(
                name: "IX_PersonalRecords_WorkoutSetLogId",
                table: "PersonalRecords",
                column: "WorkoutSetLogId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanDayOverrides_ByUserId",
                table: "PlanDayOverrides",
                column: "ByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PlanDayOverrides_PlanAssignmentId_Date",
                table: "PlanDayOverrides",
                columns: new[] { "PlanAssignmentId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlanDayOverrides_TenantId",
                table: "PlanDayOverrides",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSetLogs_ClientId_ExerciseId_PerformedAt",
                table: "WorkoutSetLogs",
                columns: new[] { "ClientId", "ExerciseId", "PerformedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSetLogs_ExerciseId",
                table: "WorkoutSetLogs",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSetLogs_TenantId",
                table: "WorkoutSetLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSetLogs_WorkoutExerciseId",
                table: "WorkoutSetLogs",
                column: "WorkoutExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutSetLogs_WorkoutLogId",
                table: "WorkoutSetLogs",
                column: "WorkoutLogId");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutLogs_WorkoutPlanAssignments_PlanAssignmentId",
                table: "WorkoutLogs",
                column: "PlanAssignmentId",
                principalTable: "WorkoutPlanAssignments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutPlans_Users_OwnerClientId",
                table: "WorkoutPlans",
                column: "OwnerClientId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutPlans_WorkoutPlans_SourcePlanId",
                table: "WorkoutPlans",
                column: "SourcePlanId",
                principalTable: "WorkoutPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutLogs_WorkoutPlanAssignments_PlanAssignmentId",
                table: "WorkoutLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutPlans_Users_OwnerClientId",
                table: "WorkoutPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutPlans_WorkoutPlans_SourcePlanId",
                table: "WorkoutPlans");

            migrationBuilder.DropTable(
                name: "PersonalRecords");

            migrationBuilder.DropTable(
                name: "PlanDayOverrides");

            migrationBuilder.DropTable(
                name: "WorkoutSetLogs");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutTemplates_OwnerPlanDayId",
                table: "WorkoutTemplates");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutPlans_OwnerClientId",
                table: "WorkoutPlans");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutPlans_SourcePlanId",
                table: "WorkoutPlans");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutPlans_TenantId_IsTemplate",
                table: "WorkoutPlans");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutLogs_PlanAssignmentId_WeekNumber_DayNumber",
                table: "WorkoutLogs");

            migrationBuilder.DropColumn(
                name: "OwnerPlanDayId",
                table: "WorkoutTemplates");

            migrationBuilder.DropColumn(
                name: "DaysPerWeekHint",
                table: "WorkoutPlans");

            migrationBuilder.DropColumn(
                name: "IsTemplate",
                table: "WorkoutPlans");

            migrationBuilder.DropColumn(
                name: "OwnerClientId",
                table: "WorkoutPlans");

            migrationBuilder.DropColumn(
                name: "SourcePlanId",
                table: "WorkoutPlans");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "WorkoutPlanDays");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "WorkoutPlanDays");

            migrationBuilder.DropColumn(
                name: "DayNumber",
                table: "WorkoutLogs");

            migrationBuilder.DropColumn(
                name: "PlanAssignmentId",
                table: "WorkoutLogs");

            migrationBuilder.DropColumn(
                name: "SessionRpe",
                table: "WorkoutLogs");

            migrationBuilder.DropColumn(
                name: "WeekNumber",
                table: "WorkoutLogs");

            migrationBuilder.DropColumn(
                name: "SetTargets",
                table: "WorkoutExercises");

            migrationBuilder.DropSequence(
                name: "PersonalRecords_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "PlanDayOverrides_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "WorkoutSetLogs_Id_hilo_seq");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutPlans_TenantId",
                table: "WorkoutPlans",
                column: "TenantId");
        }
    }
}
