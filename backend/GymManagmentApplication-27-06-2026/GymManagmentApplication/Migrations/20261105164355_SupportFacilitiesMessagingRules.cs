using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class SupportFacilitiesMessagingRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "BookingBlocks_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "BookingPenalties_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "ClassFeedbacks_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "Conversations_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "DirectMessages_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "FacilityAssets_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "FacilityMaintenances_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "FacilityReportComments_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "FacilityReports_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "IncidentAddenda_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "IncidentPeople_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "Incidents_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "MessagingUserSettings_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "SupportCannedReplies_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "SupportFaqs_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "SupportMessages_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "SupportRequests_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "BookingBlocks",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    From = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Until = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LiftedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LiftedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    LiftReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    EndNotifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookingBlocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookingBlocks_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BookingBlocks_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BookingPenalties",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BookingId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ClassId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    PtSessionId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    SessionStartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FeeAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    FeeInvoiceId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Strike = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Waived = table.Column<bool>(type: "boolean", nullable: false),
                    WaivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    WaivedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    WaiveReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookingPenalties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookingPenalties_Invoices_FeeInvoiceId",
                        column: x => x.FeeInvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BookingPenalties_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BookingPenalties_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClassFeedbacks",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BookingId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClassId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClassTypeId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TrainerId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Score = table.Column<byte>(type: "smallint", nullable: true),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Skipped = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassFeedbacks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClassFeedbacks_ClassBookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "ClassBookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ClassFeedbacks_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClassFeedbacks_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Conversations",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TrainerUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    MemberUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    LastMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastMessagePreview = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LastMessageSenderId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    MemberLastReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TrainerLastReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    MemberMuted = table.Column<bool>(type: "boolean", nullable: false),
                    TrainerMuted = table.Column<bool>(type: "boolean", nullable: false),
                    MemberRedactedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Conversations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Conversations_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Conversations_Users_MemberUserId",
                        column: x => x.MemberUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Conversations_Users_TrainerUserId",
                        column: x => x.TrainerUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FacilityAssets",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AssetType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    EquipmentId = table.Column<int>(type: "integer", nullable: true),
                    Zone = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    PhotoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SerialNumber = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    AssetCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    IsKeyFacility = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StatusReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    StatusSince = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpectedBackOn = table.Column<DateOnly>(type: "date", nullable: true),
                    StatusChangedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ServiceStatusId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    LastServicedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    NextServiceDue = table.Column<DateOnly>(type: "date", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ArchivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityAssets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacilityAssets_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityAssets_Equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FacilityAssets_ServiceStatuses_ServiceStatusId",
                        column: x => x.ServiceStatusId,
                        principalTable: "ServiceStatuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FacilityAssets_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MessagingUserSettings",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AllowTrainerMessages = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessagingUserSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MessagingUserSettings_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MessagingUserSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SupportCannedReplies",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Title = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportCannedReplies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportCannedReplies_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SupportFaqs",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Question = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Answer = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportFaqs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportFaqs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SupportRequests",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Subject = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AssigneeId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CanContact = table.Column<bool>(type: "boolean", nullable: false),
                    ContactMethod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    FirstResponseAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReopenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReopenCount = table.Column<int>(type: "integer", nullable: false),
                    LastMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastMessageBy = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Rating = table.Column<byte>(type: "smallint", nullable: true),
                    RatingComment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RedactedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportRequests_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SupportRequests_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SupportRequests_Users_AssigneeId",
                        column: x => x.AssigneeId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SupportRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DirectMessages",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ConversationId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    SenderId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientMessageId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    PhotoUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AttachmentType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AttachmentId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    AttachmentTargetId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    AttachmentTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ReportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReportedById = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ReportRequestId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    RedactedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DirectMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DirectMessages_Conversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "Conversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DirectMessages_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DirectMessages_Users_SenderId",
                        column: x => x.SenderId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FacilityMaintenances",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AssetId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PerformedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Work = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    PerformedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Cost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    NextServiceDue = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityMaintenances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacilityMaintenances_FacilityAssets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "FacilityAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FacilityMaintenances_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FacilityReports",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AssetId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    OtherLocation = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ProblemType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    PhotoUrls = table.Column<string>(type: "character varying(3100)", maxLength: 3100, nullable: true),
                    ReporterUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsUrgent = table.Column<bool>(type: "boolean", nullable: false),
                    AssignedToUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ResolutionNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolvedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    PlusOneCount = table.Column<int>(type: "integer", nullable: false),
                    LastActivityAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacilityReports_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityReports_FacilityAssets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "FacilityAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_FacilityReports_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityReports_Users_ReporterUserId",
                        column: x => x.ReporterUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Incidents",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Location = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    FirstAidGiven = table.Column<bool>(type: "boolean", nullable: false),
                    FirstAidBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    AmbulanceCalled = table.Column<bool>(type: "boolean", nullable: false),
                    Witnesses = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    FollowUpActions = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    AttachmentUrls = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: true),
                    AssetId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ClosureNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReportedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Incidents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Incidents_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Incidents_FacilityAssets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "FacilityAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Incidents_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Incidents_Users_ReportedByUserId",
                        column: x => x.ReportedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SupportMessages",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RequestId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    AuthorId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    AuthorRole = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false),
                    Body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Photos = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupportMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SupportMessages_SupportRequests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "SupportRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SupportMessages_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SupportMessages_Users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FacilityReportComments",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ReportId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Body = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    IsStaff = table.Column<bool>(type: "boolean", nullable: false),
                    IsInternal = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityReportComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FacilityReportComments_FacilityReports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "FacilityReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FacilityReportComments_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityReportComments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FacilityReportFollowers",
                columns: table => new
                {
                    ReportId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FacilityReportFollowers", x => new { x.ReportId, x.UserId });
                    table.ForeignKey(
                        name: "FK_FacilityReportFollowers_FacilityReports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "FacilityReports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FacilityReportFollowers_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FacilityReportFollowers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "IncidentAddenda",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    IncidentId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Body = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: false),
                    AuthorUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IncidentAddenda", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IncidentAddenda_Incidents_IncidentId",
                        column: x => x.IncidentId,
                        principalTable: "Incidents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IncidentAddenda_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IncidentAddenda_Users_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "IncidentPeople",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    IncidentId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Contact = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsInjuredParty = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IncidentPeople", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IncidentPeople_Incidents_IncidentId",
                        column: x => x.IncidentId,
                        principalTable: "Incidents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IncidentPeople_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_IncidentPeople_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BookingBlocks_ClientId",
                table: "BookingBlocks",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_BookingBlocks_TenantId_ClientId_Until",
                table: "BookingBlocks",
                columns: new[] { "TenantId", "ClientId", "Until" });

            migrationBuilder.CreateIndex(
                name: "IX_BookingPenalties_ClientId",
                table: "BookingPenalties",
                column: "ClientId");

            migrationBuilder.CreateIndex(
                name: "IX_BookingPenalties_FeeInvoiceId",
                table: "BookingPenalties",
                column: "FeeInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_BookingPenalties_TenantId_ClassId",
                table: "BookingPenalties",
                columns: new[] { "TenantId", "ClassId" });

            migrationBuilder.CreateIndex(
                name: "IX_BookingPenalties_TenantId_ClientId_CreatedAt",
                table: "BookingPenalties",
                columns: new[] { "TenantId", "ClientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_BookingPenalties_TenantId_Type_BookingId",
                table: "BookingPenalties",
                columns: new[] { "TenantId", "Type", "BookingId" },
                unique: true,
                filter: "\"BookingId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_BookingPenalties_TenantId_Type_PtSessionId",
                table: "BookingPenalties",
                columns: new[] { "TenantId", "Type", "PtSessionId" },
                unique: true,
                filter: "\"PtSessionId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ClassFeedbacks_BookingId",
                table: "ClassFeedbacks",
                column: "BookingId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ClassFeedbacks_TenantId_ClassTypeId",
                table: "ClassFeedbacks",
                columns: new[] { "TenantId", "ClassTypeId" });

            migrationBuilder.CreateIndex(
                name: "IX_ClassFeedbacks_TenantId_TrainerId",
                table: "ClassFeedbacks",
                columns: new[] { "TenantId", "TrainerId" });

            migrationBuilder.CreateIndex(
                name: "IX_ClassFeedbacks_TenantId_UserId",
                table: "ClassFeedbacks",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_ClassFeedbacks_UserId",
                table: "ClassFeedbacks",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_MemberUserId",
                table: "Conversations",
                column: "MemberUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_TenantId_LastMessageAt",
                table: "Conversations",
                columns: new[] { "TenantId", "LastMessageAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_TenantId_MemberUserId_LastMessageAt",
                table: "Conversations",
                columns: new[] { "TenantId", "MemberUserId", "LastMessageAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_TenantId_TrainerUserId_MemberUserId",
                table: "Conversations",
                columns: new[] { "TenantId", "TrainerUserId", "MemberUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Conversations_TrainerUserId",
                table: "Conversations",
                column: "TrainerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_DirectMessages_ConversationId_CreatedAt",
                table: "DirectMessages",
                columns: new[] { "ConversationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DirectMessages_SenderId_ClientMessageId",
                table: "DirectMessages",
                columns: new[] { "SenderId", "ClientMessageId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DirectMessages_SenderId_CreatedAt",
                table: "DirectMessages",
                columns: new[] { "SenderId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DirectMessages_TenantId_ReportedAt",
                table: "DirectMessages",
                columns: new[] { "TenantId", "ReportedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAssets_BranchId",
                table: "FacilityAssets",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAssets_EquipmentId",
                table: "FacilityAssets",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAssets_ServiceStatusId",
                table: "FacilityAssets",
                column: "ServiceStatusId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAssets_TenantId_AssetCode",
                table: "FacilityAssets",
                columns: new[] { "TenantId", "AssetCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAssets_TenantId_BranchId_Status",
                table: "FacilityAssets",
                columns: new[] { "TenantId", "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityAssets_TenantId_BranchId_Zone",
                table: "FacilityAssets",
                columns: new[] { "TenantId", "BranchId", "Zone" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMaintenances_AssetId_PerformedOn",
                table: "FacilityMaintenances",
                columns: new[] { "AssetId", "PerformedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityMaintenances_TenantId",
                table: "FacilityMaintenances",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReportComments_ReportId_CreatedAt",
                table: "FacilityReportComments",
                columns: new[] { "ReportId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReportComments_TenantId",
                table: "FacilityReportComments",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReportComments_UserId",
                table: "FacilityReportComments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReportFollowers_TenantId",
                table: "FacilityReportFollowers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReportFollowers_UserId",
                table: "FacilityReportFollowers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReports_AssetId",
                table: "FacilityReports",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReports_BranchId",
                table: "FacilityReports",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReports_ReporterUserId_CreatedAt",
                table: "FacilityReports",
                columns: new[] { "ReporterUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReports_TenantId_AssetId_Status",
                table: "FacilityReports",
                columns: new[] { "TenantId", "AssetId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_FacilityReports_TenantId_Status_IsUrgent",
                table: "FacilityReports",
                columns: new[] { "TenantId", "Status", "IsUrgent" });

            migrationBuilder.CreateIndex(
                name: "IX_IncidentAddenda_AuthorUserId",
                table: "IncidentAddenda",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_IncidentAddenda_IncidentId_CreatedAt",
                table: "IncidentAddenda",
                columns: new[] { "IncidentId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_IncidentAddenda_TenantId",
                table: "IncidentAddenda",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_IncidentPeople_IncidentId",
                table: "IncidentPeople",
                column: "IncidentId");

            migrationBuilder.CreateIndex(
                name: "IX_IncidentPeople_TenantId_UserId",
                table: "IncidentPeople",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_IncidentPeople_UserId",
                table: "IncidentPeople",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_AssetId",
                table: "Incidents",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_BranchId",
                table: "Incidents",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_ReportedByUserId",
                table: "Incidents",
                column: "ReportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_TenantId_BranchId_OccurredAt",
                table: "Incidents",
                columns: new[] { "TenantId", "BranchId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Incidents_TenantId_Status_OccurredAt",
                table: "Incidents",
                columns: new[] { "TenantId", "Status", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MessagingUserSettings_TenantId",
                table: "MessagingUserSettings",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_MessagingUserSettings_UserId",
                table: "MessagingUserSettings",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SupportCannedReplies_TenantId_SortOrder",
                table: "SupportCannedReplies",
                columns: new[] { "TenantId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_SupportFaqs_TenantId_SortOrder",
                table: "SupportFaqs",
                columns: new[] { "TenantId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_SupportMessages_AuthorId",
                table: "SupportMessages",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportMessages_RequestId_CreatedAt",
                table: "SupportMessages",
                columns: new[] { "RequestId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SupportMessages_TenantId",
                table: "SupportMessages",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportRequests_AssigneeId",
                table: "SupportRequests",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportRequests_BranchId",
                table: "SupportRequests",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_SupportRequests_TenantId_AssigneeId_Status",
                table: "SupportRequests",
                columns: new[] { "TenantId", "AssigneeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SupportRequests_TenantId_Status_LastMessageAt",
                table: "SupportRequests",
                columns: new[] { "TenantId", "Status", "LastMessageAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SupportRequests_TenantId_UserId_CreatedAt",
                table: "SupportRequests",
                columns: new[] { "TenantId", "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SupportRequests_UserId",
                table: "SupportRequests",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BookingBlocks");

            migrationBuilder.DropTable(
                name: "BookingPenalties");

            migrationBuilder.DropTable(
                name: "ClassFeedbacks");

            migrationBuilder.DropTable(
                name: "DirectMessages");

            migrationBuilder.DropTable(
                name: "FacilityMaintenances");

            migrationBuilder.DropTable(
                name: "FacilityReportComments");

            migrationBuilder.DropTable(
                name: "FacilityReportFollowers");

            migrationBuilder.DropTable(
                name: "IncidentAddenda");

            migrationBuilder.DropTable(
                name: "IncidentPeople");

            migrationBuilder.DropTable(
                name: "MessagingUserSettings");

            migrationBuilder.DropTable(
                name: "SupportCannedReplies");

            migrationBuilder.DropTable(
                name: "SupportFaqs");

            migrationBuilder.DropTable(
                name: "SupportMessages");

            migrationBuilder.DropTable(
                name: "Conversations");

            migrationBuilder.DropTable(
                name: "FacilityReports");

            migrationBuilder.DropTable(
                name: "Incidents");

            migrationBuilder.DropTable(
                name: "SupportRequests");

            migrationBuilder.DropTable(
                name: "FacilityAssets");

            migrationBuilder.DropSequence(
                name: "BookingBlocks_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "BookingPenalties_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "ClassFeedbacks_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "Conversations_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "DirectMessages_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "FacilityAssets_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "FacilityMaintenances_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "FacilityReportComments_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "FacilityReports_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "IncidentAddenda_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "IncidentPeople_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "Incidents_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "MessagingUserSettings_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "SupportCannedReplies_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "SupportFaqs_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "SupportMessages_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "SupportRequests_Id_hilo_seq");
        }
    }
}
