using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class FaceCheckIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "FaceCheckInAttempts_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "FaceEnrollments_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.AddColumn<decimal>(
                name: "FaceScore",
                table: "Attendances",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FaceVerified",
                table: "Attendances",
                type: "boolean",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FaceCheckInAttempts",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Similarity = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    Threshold = table.Column<int>(type: "integer", nullable: false),
                    Detail = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CapturedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SelfieUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AttendanceId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FaceCheckInAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FaceCheckInAttempts_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FaceCheckInAttempts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FaceEnrollments",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PhotoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EnrolledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EnrolledByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Source = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FaceEnrollments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FaceEnrollments_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FaceEnrollments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FaceCheckInAttempts_TenantId_At",
                table: "FaceCheckInAttempts",
                columns: new[] { "TenantId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_FaceCheckInAttempts_TenantId_UserId_At",
                table: "FaceCheckInAttempts",
                columns: new[] { "TenantId", "UserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_FaceCheckInAttempts_UserId",
                table: "FaceCheckInAttempts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FaceEnrollments_TenantId_UserId",
                table: "FaceEnrollments",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FaceEnrollments_UserId",
                table: "FaceEnrollments",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FaceCheckInAttempts");

            migrationBuilder.DropTable(
                name: "FaceEnrollments");

            migrationBuilder.DropColumn(
                name: "FaceScore",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "FaceVerified",
                table: "Attendances");

            migrationBuilder.DropSequence(
                name: "FaceCheckInAttempts_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "FaceEnrollments_Id_hilo_seq");
        }
    }
}
