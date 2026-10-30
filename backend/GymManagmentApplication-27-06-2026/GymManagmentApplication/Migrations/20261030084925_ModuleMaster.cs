using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class ModuleMaster : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserModuleAccesses_UserId",
                table: "UserModuleAccesses");

            migrationBuilder.AddColumn<bool>(
                name: "AdminOnly",
                table: "Modules",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ApiModules",
                table: "Modules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "App",
                table: "Modules",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "HideFromMenu",
                table: "Modules",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsTab",
                table: "Modules",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "Level",
                table: "Modules",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "NameTranslations",
                table: "Modules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ParentId",
                table: "Modules",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Route",
                table: "Modules",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "Modules",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "RoleModuleGrants",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RoleId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ModuleId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CanView = table.Column<bool>(type: "boolean", nullable: false),
                    CanCreate = table.Column<bool>(type: "boolean", nullable: false),
                    CanEdit = table.Column<bool>(type: "boolean", nullable: false),
                    CanDelete = table.Column<bool>(type: "boolean", nullable: false),
                    CanExport = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleModuleGrants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoleModuleGrants_Modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "Modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RoleModuleGrants_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RoleModuleGrants_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRoles",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RoleId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserRoles_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserRoles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // The old tables had no unique keys. Collapse duplicates before the unique indexes
            // below: keep the lowest-id module per key (repointing its access rows), and the
            // newest access row per user + module.
            migrationBuilder.Sql("""
                UPDATE "UserModuleAccesses" a SET "ModuleId" = k."KeepId"
                FROM (SELECT "Id", MIN("Id") OVER (PARTITION BY "Key") AS "KeepId" FROM "Modules") k
                WHERE a."ModuleId" = k."Id" AND k."Id" <> k."KeepId";
                DELETE FROM "Modules" m USING "Modules" d WHERE m."Key" = d."Key" AND m."Id" > d."Id";
                DELETE FROM "UserModuleAccesses" a USING "UserModuleAccesses" d
                WHERE a."UserId" = d."UserId" AND a."ModuleId" = d."ModuleId"
                  AND (a."GrantedAt" < d."GrantedAt" OR (a."GrantedAt" = d."GrantedAt" AND a."Id" < d."Id"));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_UserModuleAccesses_UserId_ModuleId",
                table: "UserModuleAccesses",
                columns: new[] { "UserId", "ModuleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Modules_Key",
                table: "Modules",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Modules_ParentId",
                table: "Modules",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleModuleGrants_ModuleId",
                table: "RoleModuleGrants",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleModuleGrants_RoleId",
                table: "RoleModuleGrants",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleModuleGrants_TenantId_RoleId_ModuleId",
                table: "RoleModuleGrants",
                columns: new[] { "TenantId", "RoleId", "ModuleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_UserId_RoleId",
                table: "UserRoles",
                columns: new[] { "UserId", "RoleId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Modules_Modules_ParentId",
                table: "Modules",
                column: "ParentId",
                principalTable: "Modules",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Modules_Modules_ParentId",
                table: "Modules");

            migrationBuilder.DropTable(
                name: "RoleModuleGrants");

            migrationBuilder.DropTable(
                name: "UserRoles");

            migrationBuilder.DropIndex(
                name: "IX_UserModuleAccesses_UserId_ModuleId",
                table: "UserModuleAccesses");

            migrationBuilder.DropIndex(
                name: "IX_Modules_Key",
                table: "Modules");

            migrationBuilder.DropIndex(
                name: "IX_Modules_ParentId",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "AdminOnly",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "ApiModules",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "App",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "HideFromMenu",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "IsTab",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "Level",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "NameTranslations",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "Route",
                table: "Modules");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "Modules");

            migrationBuilder.CreateIndex(
                name: "IX_UserModuleAccesses_UserId",
                table: "UserModuleAccesses",
                column: "UserId");
        }
    }
}
