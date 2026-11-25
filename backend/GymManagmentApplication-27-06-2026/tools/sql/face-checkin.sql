START TRANSACTION;
CREATE SEQUENCE "FaceCheckInAttempts_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

CREATE SEQUENCE "FaceEnrollments_Id_hilo_seq" START WITH 1 INCREMENT BY 10 NO CYCLE;

ALTER TABLE "Attendances" ADD "FaceScore" numeric(5,2);

ALTER TABLE "Attendances" ADD "FaceVerified" boolean;

CREATE TABLE "FaceCheckInAttempts" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "BranchId" numeric(20,0),
    "At" timestamp with time zone NOT NULL,
    "Outcome" character varying(20) NOT NULL,
    "Similarity" numeric(5,2),
    "Threshold" integer NOT NULL,
    "Detail" character varying(40),
    "CapturedAt" timestamp with time zone,
    "SelfieUrl" character varying(1000),
    "AttendanceId" numeric(20,0),
    CONSTRAINT "PK_FaceCheckInAttempts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_FaceCheckInAttempts_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FaceCheckInAttempts_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE TABLE "FaceEnrollments" (
    "Id" numeric(20,0) NOT NULL,
    "TenantId" numeric(20,0) NOT NULL,
    "UserId" numeric(20,0) NOT NULL,
    "PhotoUrl" character varying(1000),
    "Status" character varying(20) NOT NULL,
    "EnrolledAt" timestamp with time zone NOT NULL,
    "EnrolledByUserId" numeric(20,0),
    "Source" character varying(10) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_FaceEnrollments" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_FaceEnrollments_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_FaceEnrollments_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);

CREATE INDEX "IX_FaceCheckInAttempts_TenantId_At" ON "FaceCheckInAttempts" ("TenantId", "At");

CREATE INDEX "IX_FaceCheckInAttempts_TenantId_UserId_At" ON "FaceCheckInAttempts" ("TenantId", "UserId", "At");

CREATE INDEX "IX_FaceCheckInAttempts_UserId" ON "FaceCheckInAttempts" ("UserId");

CREATE UNIQUE INDEX "IX_FaceEnrollments_TenantId_UserId" ON "FaceEnrollments" ("TenantId", "UserId");

CREATE INDEX "IX_FaceEnrollments_UserId" ON "FaceEnrollments" ("UserId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261118055347_FaceCheckIn', '9.0.0');

COMMIT;

