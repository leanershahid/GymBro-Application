using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class BillingLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_TenantId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_TenantId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_GymMemberships_UserId",
                table: "GymMemberships");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Payments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RecordedBy",
                table: "Payments",
                type: "numeric(20,0)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Reference",
                table: "Payments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RefundedAmount",
                table: "Payments",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "AmountPaid",
                table: "Invoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Items",
                table: "Invoices",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId_CreatedAt",
                table: "Payments",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_TenantId_InvoiceNo",
                table: "Invoices",
                columns: new[] { "TenantId", "InvoiceNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_TenantId_UserId",
                table: "Invoices",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_GymMemberships_UserId_Status",
                table: "GymMemberships",
                columns: new[] { "UserId", "Status" });

            // Invoices settled before AmountPaid existed (Status 2 = Paid) are fully paid.
            migrationBuilder.Sql("UPDATE \"Invoices\" SET \"AmountPaid\" = \"Total\" WHERE \"Status\" = 2;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_TenantId_CreatedAt",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_TenantId_InvoiceNo",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_TenantId_UserId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_GymMemberships_UserId_Status",
                table: "GymMemberships");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "RecordedBy",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Reference",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "RefundedAmount",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "AmountPaid",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "Items",
                table: "Invoices");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId",
                table: "Payments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_TenantId",
                table: "Invoices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_GymMemberships_UserId",
                table: "GymMemberships",
                column: "UserId");
        }
    }
}
