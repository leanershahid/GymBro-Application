using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GymManagmentApplication.Migrations
{
    /// <inheritdoc />
    public partial class SocialModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The old, never-used SocialPosts table (Content/Media/LikesCount…) is replaced by the new
            // schema. EF would have altered it in place and turned IsVisible into IsDeleted (inverted),
            // so it is removed first: dropped when empty, otherwise kept as LegacySocialPosts.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "SocialPosts") THEN
                        ALTER TABLE "SocialPosts" RENAME CONSTRAINT "PK_SocialPosts" TO "PK_LegacySocialPosts";
                        ALTER TABLE "SocialPosts" RENAME CONSTRAINT "FK_SocialPosts_Tenants_TenantId" TO "FK_LegacySocialPosts_Tenants_TenantId";
                        ALTER TABLE "SocialPosts" RENAME CONSTRAINT "FK_SocialPosts_Users_UserId" TO "FK_LegacySocialPosts_Users_UserId";
                        ALTER INDEX "IX_SocialPosts_TenantId" RENAME TO "IX_LegacySocialPosts_TenantId";
                        ALTER INDEX "IX_SocialPosts_UserId" RENAME TO "IX_LegacySocialPosts_UserId";
                        ALTER TABLE "SocialPosts" RENAME TO "LegacySocialPosts";
                    ELSE
                        DROP TABLE "SocialPosts";
                    END IF;
                END $$;
                """);

            migrationBuilder.CreateTable(
                name: "SocialPosts",
                columns: table => new
                {
                    PostId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    TenantId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Caption = table.Column<string>(type: "character varying(2200)", maxLength: 2200, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModifiedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SocialPosts", x => x.PostId);
                    table.ForeignKey(
                        name: "FK_SocialPosts_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SocialPosts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SocialPostComments",
                columns: table => new
                {
                    CommentId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PostId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CommentText = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModifiedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SocialPostComments", x => x.CommentId);
                    table.ForeignKey(
                        name: "FK_SocialPostComments_SocialPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "SocialPosts",
                        principalColumn: "PostId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SocialPostComments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SocialPostImages",
                columns: table => new
                {
                    ImageId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PostId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SocialPostImages", x => x.ImageId);
                    table.ForeignKey(
                        name: "FK_SocialPostImages_SocialPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "SocialPosts",
                        principalColumn: "PostId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SocialPostLikes",
                columns: table => new
                {
                    LikeId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    PostId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    UserId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SocialPostLikes", x => x.LikeId);
                    table.ForeignKey(
                        name: "FK_SocialPostLikes_SocialPosts_PostId",
                        column: x => x.PostId,
                        principalTable: "SocialPosts",
                        principalColumn: "PostId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SocialPostLikes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SocialPosts_TenantId_IsDeleted_IsActive_PostId",
                table: "SocialPosts",
                columns: new[] { "TenantId", "IsDeleted", "IsActive", "PostId" },
                descending: new[] { false, false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_SocialPostComments_PostId_IsDeleted_CommentId",
                table: "SocialPostComments",
                columns: new[] { "PostId", "IsDeleted", "CommentId" });

            migrationBuilder.CreateIndex(
                name: "IX_SocialPostComments_UserId",
                table: "SocialPostComments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SocialPostImages_PostId_DisplayOrder",
                table: "SocialPostImages",
                columns: new[] { "PostId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_SocialPostLikes_PostId_UserId",
                table: "SocialPostLikes",
                columns: new[] { "PostId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SocialPostLikes_UserId",
                table: "SocialPostLikes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SocialPosts_UserId",
                table: "SocialPosts",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "SocialPostComments");
            migrationBuilder.DropTable(name: "SocialPostImages");
            migrationBuilder.DropTable(name: "SocialPostLikes");
            migrationBuilder.DropTable(name: "SocialPosts");

            // Put the old table back if Up kept it (it only exists when it held rows).
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF to_regclass('"LegacySocialPosts"') IS NOT NULL THEN
                        ALTER TABLE "LegacySocialPosts" RENAME TO "SocialPosts";
                        ALTER TABLE "SocialPosts" RENAME CONSTRAINT "PK_LegacySocialPosts" TO "PK_SocialPosts";
                        ALTER TABLE "SocialPosts" RENAME CONSTRAINT "FK_LegacySocialPosts_Tenants_TenantId" TO "FK_SocialPosts_Tenants_TenantId";
                        ALTER TABLE "SocialPosts" RENAME CONSTRAINT "FK_LegacySocialPosts_Users_UserId" TO "FK_SocialPosts_Users_UserId";
                        ALTER INDEX "IX_LegacySocialPosts_TenantId" RENAME TO "IX_SocialPosts_TenantId";
                        ALTER INDEX "IX_LegacySocialPosts_UserId" RENAME TO "IX_SocialPosts_UserId";
                    END IF;
                END $$;
                """);
        }
    }
}
