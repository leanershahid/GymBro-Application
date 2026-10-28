using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class LocationAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Attendances_UserId",
                table: "Attendances");

            migrationBuilder.AddColumn<int>(
                name: "GeofenceRadiusM",
                table: "Branches",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "LocationCheckInEnabled",
                table: "Branches",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "CheckInDistanceM",
                table: "Attendances",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckInLat",
                table: "Attendances",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CheckInLng",
                table: "Attendances",
                type: "numeric(10,7)",
                precision: 10,
                scale: 7,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_UserId_CheckInAt",
                table: "Attendances",
                columns: new[] { "UserId", "CheckInAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Attendances_UserId_CheckInAt",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "GeofenceRadiusM",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "LocationCheckInEnabled",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "CheckInDistanceM",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "CheckInLat",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "CheckInLng",
                table: "Attendances");

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_UserId",
                table: "Attendances",
                column: "UserId");
        }
    }
}
