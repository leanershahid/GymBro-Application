using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class FixCreatorForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Rows written before this fix only have a valid creator in the old CreatorId column; carry it over
            // so the new CreatedBy foreign key can be added without failing on bad values.
            foreach (var table in new[] { "WorkoutPlans", "WorkoutTemplates", "DietPlans" })
                migrationBuilder.Sql($"""UPDATE "{table}" t SET "CreatedBy" = t."CreatorId" WHERE NOT EXISTS (SELECT 1 FROM "Users" u WHERE u."Id" = t."CreatedBy");""");
            migrationBuilder.Sql("""UPDATE "Exercises" t SET "CreatedBy" = t."CreatorId" WHERE t."CreatedBy" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Users" u WHERE u."Id" = t."CreatedBy");""");

            migrationBuilder.DropForeignKey(
                name: "FK_DietPlans_Users_CreatorId",
                table: "DietPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_Exercises_Users_CreatorId",
                table: "Exercises");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutPlans_Users_CreatorId",
                table: "WorkoutPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutTemplates_Users_CreatorId",
                table: "WorkoutTemplates");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutTemplates_CreatorId",
                table: "WorkoutTemplates");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutPlans_CreatorId",
                table: "WorkoutPlans");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_CreatorId",
                table: "Exercises");

            migrationBuilder.DropIndex(
                name: "IX_DietPlans_CreatorId",
                table: "DietPlans");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "WorkoutTemplates");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "WorkoutPlans");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "Exercises");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "DietPlans");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutTemplates_CreatedBy",
                table: "WorkoutTemplates",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutPlans_CreatedBy",
                table: "WorkoutPlans",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_CreatedBy",
                table: "Exercises",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_DietPlans_CreatedBy",
                table: "DietPlans",
                column: "CreatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_DietPlans_Users_CreatedBy",
                table: "DietPlans",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Exercises_Users_CreatedBy",
                table: "Exercises",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutPlans_Users_CreatedBy",
                table: "WorkoutPlans",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutTemplates_Users_CreatedBy",
                table: "WorkoutTemplates",
                column: "CreatedBy",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DietPlans_Users_CreatedBy",
                table: "DietPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_Exercises_Users_CreatedBy",
                table: "Exercises");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutPlans_Users_CreatedBy",
                table: "WorkoutPlans");

            migrationBuilder.DropForeignKey(
                name: "FK_WorkoutTemplates_Users_CreatedBy",
                table: "WorkoutTemplates");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutTemplates_CreatedBy",
                table: "WorkoutTemplates");

            migrationBuilder.DropIndex(
                name: "IX_WorkoutPlans_CreatedBy",
                table: "WorkoutPlans");

            migrationBuilder.DropIndex(
                name: "IX_Exercises_CreatedBy",
                table: "Exercises");

            migrationBuilder.DropIndex(
                name: "IX_DietPlans_CreatedBy",
                table: "DietPlans");

            migrationBuilder.AddColumn<decimal>(
                name: "CreatorId",
                table: "WorkoutTemplates",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CreatorId",
                table: "WorkoutPlans",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "CreatorId",
                table: "Exercises",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CreatorId",
                table: "DietPlans",
                type: "numeric(20,0)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutTemplates_CreatorId",
                table: "WorkoutTemplates",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkoutPlans_CreatorId",
                table: "WorkoutPlans",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_CreatorId",
                table: "Exercises",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_DietPlans_CreatorId",
                table: "DietPlans",
                column: "CreatorId");

            migrationBuilder.AddForeignKey(
                name: "FK_DietPlans_Users_CreatorId",
                table: "DietPlans",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Exercises_Users_CreatorId",
                table: "Exercises",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutPlans_Users_CreatorId",
                table: "WorkoutPlans",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_WorkoutTemplates_Users_CreatorId",
                table: "WorkoutTemplates",
                column: "CreatorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
