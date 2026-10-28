using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class AddUserModuleAccessCrudFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CanAdd",
                table: "UserModuleAccesses",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "CanDelete",
                table: "UserModuleAccesses",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "CanEdit",
                table: "UserModuleAccesses",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CanAdd",
                table: "UserModuleAccesses");

            migrationBuilder.DropColumn(
                name: "CanDelete",
                table: "UserModuleAccesses");

            migrationBuilder.DropColumn(
                name: "CanEdit",
                table: "UserModuleAccesses");
        }
    }
}
