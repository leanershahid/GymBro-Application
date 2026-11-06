using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class MemberJourneyFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "AccountDeletionRequests_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "Announcements_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "BranchHoursExceptions_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "BranchOpeningIntervals_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "BranchProfiles_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "ConsentRecords_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "DataExportRequests_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "HealthScreenings_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "MemberEmergencyContacts_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "MembershipRequests_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "NotificationPreferences_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "PushDevices_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "SafetyGateOverrides_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "ServiceStatuses_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "TrustedDevices_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "TwoFactorChallenges_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "TwoFactorRecoveryCodes_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "UserTwoFactors_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "WaitlistOffers_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "WaiverDocuments_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "WaiverSignatures_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "WaiverVersions_Id_hilo_seq",
                incrementBy: 10);

            migrationBuilder.AddColumn<string>(
                name: "AccessHours",
                table: "MembershipPlans",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ClassCredits",
                table: "MembershipPlans",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPopular",
                table: "MembershipPlans",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPublic",
                table: "MembershipPlans",
                type: "boolean",
                nullable: false,
                // Existing plans stay visible to members online.
                defaultValue: true);

            migrationBuilder.AddColumn<decimal>(
                name: "JoiningFee",
                table: "MembershipPlans",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "PtSessions",
                table: "MembershipPlans",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Meta",
                table: "CommunicationLogs",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NotBefore",
                table: "CommunicationLogs",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AccountDeletionRequests",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RequestedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ScheduledFor = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProcessedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    BlockedReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Summary = table.Column<string>(type: "jsonb", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountDeletionRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccountDeletionRequests_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AccountDeletionRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Announcements",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Body = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CtaLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CtaRoute = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Audience = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AudienceIds = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    IsPinned = table.Column<bool>(type: "boolean", nullable: false),
                    IsUrgent = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PublishAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeliveryLockedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RecipientCount = table.Column<int>(type: "integer", nullable: false),
                    CreatedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Announcements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Announcements_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BranchHoursExceptions",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    IsClosed = table.Column<bool>(type: "boolean", nullable: false),
                    Intervals = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchHoursExceptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchHoursExceptions_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BranchHoursExceptions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BranchOpeningIntervals",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    OpensAt = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    ClosesAt = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchOpeningIntervals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchOpeningIntervals_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BranchOpeningIntervals_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BranchProfiles",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Amenities = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    Accessibility = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    UpdatedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchProfiles_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BranchProfiles_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ConsentRecords",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Granted = table.Column<bool>(type: "boolean", nullable: false),
                    Version = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    RecordedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsentRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsentRecords_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConsentRecords_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DataExportRequests",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RequestedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReadyAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FileUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    Error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DataExportRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DataExportRequests_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DataExportRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HealthScreenings",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    FormVersion = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Answers = table.Column<string>(type: "jsonb", nullable: false),
                    YesCount = table.Column<int>(type: "integer", nullable: false),
                    Conditions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Medications = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Injuries = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Pregnancy = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    NeedsClearance = table.Column<bool>(type: "boolean", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClearedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClearedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    ClearanceNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HealthScreenings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HealthScreenings_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HealthScreenings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MemberEmergencyContacts",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Relationship = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    UpdatedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MemberEmergencyContacts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MemberEmergencyContacts_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MemberEmergencyContacts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MembershipRequests",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    MembershipId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ReasonCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RequestedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: true),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    NewPlanId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Fee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    InvoiceId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    AutoApproved = table.Column<bool>(type: "boolean", nullable: false),
                    DecidedBy = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecisionNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MembershipRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MembershipRequests_GymMemberships_MembershipId",
                        column: x => x.MembershipId,
                        principalTable: "GymMemberships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MembershipRequests_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MembershipRequests_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "NotificationPreferences",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Channels = table.Column<string>(type: "jsonb", nullable: true),
                    QuietHoursEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    QuietStart = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    QuietEnd = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationPreferences_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_NotificationPreferences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PushDevices",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Token = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Platform = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    DeviceName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DisabledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DisabledReason = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushDevices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PushDevices_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PushDevices_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SafetyGateOverrides",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    OverriddenByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Context = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Missing = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AttendanceId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SafetyGateOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SafetyGateOverrides_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SafetyGateOverrides_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ServiceStatuses",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BranchId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    Area = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceStatuses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceStatuses_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ServiceStatuses_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TrustedDevices",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    UserAgent = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrustedDevices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrustedDevices_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TwoFactorChallenges",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    EmailSends = table.Column<int>(type: "integer", nullable: false),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TwoFactorChallenges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TwoFactorChallenges_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TwoFactorRecoveryCodes",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TwoFactorRecoveryCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TwoFactorRecoveryCodes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserTwoFactors",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    SecretProtected = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    EnabledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PendingSecretProtected = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    PendingCreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastUsedStep = table.Column<long>(type: "bigint", nullable: false),
                    GraceStartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTwoFactors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTwoFactors_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WaitlistOffers",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClassId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    BookingId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ClientId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    OfferedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WaitlistOffers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WaitlistOffers_ClassBookings_BookingId",
                        column: x => x.BookingId,
                        principalTable: "ClassBookings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WaitlistOffers_GymClasses_ClassId",
                        column: x => x.ClassId,
                        principalTable: "GymClasses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_WaitlistOffers_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WaitlistOffers_Users_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WaiverDocuments",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WaiverDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WaiverDocuments_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AnnouncementRecipients",
                columns: table => new
                {
                    AnnouncementId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    DeliveredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnnouncementRecipients", x => new { x.AnnouncementId, x.UserId });
                    table.ForeignKey(
                        name: "FK_AnnouncementRecipients_Announcements_AnnouncementId",
                        column: x => x.AnnouncementId,
                        principalTable: "Announcements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AnnouncementRecipients_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AnnouncementRecipients_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WaiverVersions",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    WaiverId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Body = table.Column<string>(type: "character varying(50000)", maxLength: 50000, nullable: false),
                    BodyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RequiresResign = table.Column<bool>(type: "boolean", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PublishedByUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WaiverVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WaiverVersions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WaiverVersions_WaiverDocuments_WaiverId",
                        column: x => x.WaiverId,
                        principalTable: "WaiverDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WaiverSignatures",
                columns: table => new
                {
                    Id = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    WaiverId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    WaiverVersionId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    SignedName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    BodyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    WitnessUserId = table.Column<decimal>(type: "numeric(20,0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WaiverSignatures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WaiverSignatures_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WaiverSignatures_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WaiverSignatures_WaiverDocuments_WaiverId",
                        column: x => x.WaiverId,
                        principalTable: "WaiverDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WaiverSignatures_WaiverVersions_WaiverVersionId",
                        column: x => x.WaiverVersionId,
                        principalTable: "WaiverVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountDeletionRequests_TenantId_Status_ScheduledFor",
                table: "AccountDeletionRequests",
                columns: new[] { "TenantId", "Status", "ScheduledFor" });

            migrationBuilder.CreateIndex(
                name: "IX_AccountDeletionRequests_TenantId_UserId",
                table: "AccountDeletionRequests",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_AccountDeletionRequests_UserId",
                table: "AccountDeletionRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AnnouncementRecipients_TenantId",
                table: "AnnouncementRecipients",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AnnouncementRecipients_UserId_ReadAt",
                table: "AnnouncementRecipients",
                columns: new[] { "UserId", "ReadAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_Status_PublishAt",
                table: "Announcements",
                columns: new[] { "Status", "PublishAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_TenantId_Status",
                table: "Announcements",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_BranchHoursExceptions_BranchId_Date",
                table: "BranchHoursExceptions",
                columns: new[] { "BranchId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BranchHoursExceptions_TenantId",
                table: "BranchHoursExceptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchOpeningIntervals_BranchId_DayOfWeek",
                table: "BranchOpeningIntervals",
                columns: new[] { "BranchId", "DayOfWeek" });

            migrationBuilder.CreateIndex(
                name: "IX_BranchOpeningIntervals_TenantId",
                table: "BranchOpeningIntervals",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchProfiles_BranchId",
                table: "BranchProfiles",
                column: "BranchId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BranchProfiles_TenantId",
                table: "BranchProfiles",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsentRecords_TenantId_UserId_Type_At",
                table: "ConsentRecords",
                columns: new[] { "TenantId", "UserId", "Type", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_ConsentRecords_UserId",
                table: "ConsentRecords",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DataExportRequests_Status_RequestedAt",
                table: "DataExportRequests",
                columns: new[] { "Status", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DataExportRequests_TenantId_UserId_RequestedAt",
                table: "DataExportRequests",
                columns: new[] { "TenantId", "UserId", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DataExportRequests_UserId",
                table: "DataExportRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_HealthScreenings_TenantId_UserId_SubmittedAt",
                table: "HealthScreenings",
                columns: new[] { "TenantId", "UserId", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_HealthScreenings_UserId",
                table: "HealthScreenings",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_MemberEmergencyContacts_TenantId",
                table: "MemberEmergencyContacts",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_MemberEmergencyContacts_UserId",
                table: "MemberEmergencyContacts",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MembershipRequests_MembershipId_Status",
                table: "MembershipRequests",
                columns: new[] { "MembershipId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_MembershipRequests_TenantId_Status_Type_RequestedAt",
                table: "MembershipRequests",
                columns: new[] { "TenantId", "Status", "Type", "RequestedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MembershipRequests_TenantId_UserId",
                table: "MembershipRequests",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_MembershipRequests_UserId",
                table: "MembershipRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationPreferences_TenantId",
                table: "NotificationPreferences",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationPreferences_UserId",
                table: "NotificationPreferences",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushDevices_TenantId",
                table: "PushDevices",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_PushDevices_Token",
                table: "PushDevices",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushDevices_UserId_DisabledAt",
                table: "PushDevices",
                columns: new[] { "UserId", "DisabledAt" });

            migrationBuilder.CreateIndex(
                name: "IX_SafetyGateOverrides_TenantId_UserId_At",
                table: "SafetyGateOverrides",
                columns: new[] { "TenantId", "UserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_SafetyGateOverrides_UserId",
                table: "SafetyGateOverrides",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceStatuses_BranchId",
                table: "ServiceStatuses",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceStatuses_TenantId_BranchId_EndsAt",
                table: "ServiceStatuses",
                columns: new[] { "TenantId", "BranchId", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TrustedDevices_TokenHash",
                table: "TrustedDevices",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrustedDevices_UserId",
                table: "TrustedDevices",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TwoFactorChallenges_TokenHash",
                table: "TwoFactorChallenges",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TwoFactorChallenges_UserId",
                table: "TwoFactorChallenges",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TwoFactorRecoveryCodes_UserId",
                table: "TwoFactorRecoveryCodes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTwoFactors_UserId",
                table: "UserTwoFactors",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistOffers_BookingId",
                table: "WaitlistOffers",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistOffers_ClassId_Status",
                table: "WaitlistOffers",
                columns: new[] { "ClassId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistOffers_ClientId_Status",
                table: "WaitlistOffers",
                columns: new[] { "ClientId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistOffers_Status_ExpiresAt",
                table: "WaitlistOffers",
                columns: new[] { "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_WaitlistOffers_TenantId",
                table: "WaitlistOffers",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WaiverDocuments_TenantId_IsActive",
                table: "WaiverDocuments",
                columns: new[] { "TenantId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_WaiverSignatures_TenantId_UserId",
                table: "WaiverSignatures",
                columns: new[] { "TenantId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_WaiverSignatures_UserId_WaiverVersionId",
                table: "WaiverSignatures",
                columns: new[] { "UserId", "WaiverVersionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WaiverSignatures_WaiverId",
                table: "WaiverSignatures",
                column: "WaiverId");

            migrationBuilder.CreateIndex(
                name: "IX_WaiverSignatures_WaiverVersionId",
                table: "WaiverSignatures",
                column: "WaiverVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_WaiverVersions_TenantId",
                table: "WaiverVersions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_WaiverVersions_WaiverId_Version",
                table: "WaiverVersions",
                columns: new[] { "WaiverId", "Version" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountDeletionRequests");

            migrationBuilder.DropTable(
                name: "AnnouncementRecipients");

            migrationBuilder.DropTable(
                name: "BranchHoursExceptions");

            migrationBuilder.DropTable(
                name: "BranchOpeningIntervals");

            migrationBuilder.DropTable(
                name: "BranchProfiles");

            migrationBuilder.DropTable(
                name: "ConsentRecords");

            migrationBuilder.DropTable(
                name: "DataExportRequests");

            migrationBuilder.DropTable(
                name: "HealthScreenings");

            migrationBuilder.DropTable(
                name: "MemberEmergencyContacts");

            migrationBuilder.DropTable(
                name: "MembershipRequests");

            migrationBuilder.DropTable(
                name: "NotificationPreferences");

            migrationBuilder.DropTable(
                name: "PushDevices");

            migrationBuilder.DropTable(
                name: "SafetyGateOverrides");

            migrationBuilder.DropTable(
                name: "ServiceStatuses");

            migrationBuilder.DropTable(
                name: "TrustedDevices");

            migrationBuilder.DropTable(
                name: "TwoFactorChallenges");

            migrationBuilder.DropTable(
                name: "TwoFactorRecoveryCodes");

            migrationBuilder.DropTable(
                name: "UserTwoFactors");

            migrationBuilder.DropTable(
                name: "WaitlistOffers");

            migrationBuilder.DropTable(
                name: "WaiverSignatures");

            migrationBuilder.DropTable(
                name: "Announcements");

            migrationBuilder.DropTable(
                name: "WaiverVersions");

            migrationBuilder.DropTable(
                name: "WaiverDocuments");

            migrationBuilder.DropColumn(
                name: "AccessHours",
                table: "MembershipPlans");

            migrationBuilder.DropColumn(
                name: "ClassCredits",
                table: "MembershipPlans");

            migrationBuilder.DropColumn(
                name: "IsPopular",
                table: "MembershipPlans");

            migrationBuilder.DropColumn(
                name: "IsPublic",
                table: "MembershipPlans");

            migrationBuilder.DropColumn(
                name: "JoiningFee",
                table: "MembershipPlans");

            migrationBuilder.DropColumn(
                name: "PtSessions",
                table: "MembershipPlans");

            migrationBuilder.DropColumn(
                name: "Meta",
                table: "CommunicationLogs");

            migrationBuilder.DropColumn(
                name: "NotBefore",
                table: "CommunicationLogs");

            migrationBuilder.DropSequence(
                name: "AccountDeletionRequests_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "Announcements_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "BranchHoursExceptions_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "BranchOpeningIntervals_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "BranchProfiles_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "ConsentRecords_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "DataExportRequests_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "HealthScreenings_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "MemberEmergencyContacts_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "MembershipRequests_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "NotificationPreferences_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "PushDevices_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "SafetyGateOverrides_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "ServiceStatuses_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "TrustedDevices_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "TwoFactorChallenges_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "TwoFactorRecoveryCodes_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "UserTwoFactors_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "WaitlistOffers_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "WaiverDocuments_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "WaiverSignatures_Id_hilo_seq");

            migrationBuilder.DropSequence(
                name: "WaiverVersions_Id_hilo_seq");
        }
    }
}
