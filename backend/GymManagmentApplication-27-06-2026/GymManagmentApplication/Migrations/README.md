# Migrations

EF Core 9 migrations for `AppDbContext` (Npgsql). They are applied on startup under a Postgres
advisory lock (`Database:MigrateOnStartup`, see `Program.cs`), or as a release step.

## Rules (ARCH-089)

- **Never rename, edit or delete a migration that has been applied anywhere.** EF identifies a
  migration by its id (`<timestamp>_<Name>`) in `__EFMigrationsHistory`; renaming one makes every
  existing database try to apply it again.
- New migrations get a **PascalCase, descriptive name** saying what changes, e.g.
  `dotnet ef migrations add AddShopReturns`. No `DbChanges`, `Update2`, `module-access`.
- One concern per migration; commit the migration, its `.Designer.cs` and
  `AppDbContextModelSnapshot.cs` together.
- `PostgresModelTests.Model_has_no_changes_missing_from_the_migrations` fails when the model has
  changes that no migration covers. Run `dotnet test` before pushing.

## History

| Migration | What it does | Name OK? |
|---|---|---|
| `20260623055025_SupabaseUpdate` | Baseline: the whole schema (5,084 lines) | No: really `InitialSchema` |
| `20260623074834_FixUlongAutoIncrement` | Raw SQL fixing ulong id auto-increment | Yes |
| `20260707021400_DbChanges` | ModuleAccesses table and index; Users / CorporateAccounts columns | No |
| `20260711110927_AddUserModuleAccess` | Per-user module access table | Yes |
| `20260711113337_module-access` | Empty (snapshot only) | No: kebab-case |
| `20260711150326_moduleaccess2` | Empty (snapshot only) | No |
| `20261007064832_TenantIsolationAndBranchLinks` | Tenant/branch foreign keys | Yes |
| `20261028125349_LocationAttendance` | Location-based attendance | Yes |
| `20261028180059_AddUserModuleAccessCrudFlags` | CRUD flags on module access | Yes |
| `20261029135654_DurableAuthSessionsAndCodes` | Auth sessions and codes tables | Yes |
| `20261029141010_EmailUniqueAmongLiveUsers` | Partial unique index on email | Yes |
| `20261029142140_BillingLedger` | Payment/invoice ledger columns and indexes | Yes |
| `20261030084925_ModuleMaster` | Module master and role grants | Yes |
| `20261102060640_ShopModule` | Shop tables | Yes |
| `20261102114152_FixCreatorForeignKeys` | Creator FK fixes | Yes |
| `20261102115119_SocialModule` | Social feed tables | Yes |
| `20261104115221_ArchitectureAudit` | Drops 49 unused tables; outbox and other indexes | Yes |
| `20261105092918_IdSequences` | Raw SQL for id sequences | Yes |

The names marked "No" stay as they are, because those migrations are already applied. The squash
below replaces them.

## Squash plan

Do this once, when **every** database (local, staging, production, and any preview or Supabase
branch) has applied the latest migration. Before that, a squash would leave a lagging database
with no path forward.

1. **Freeze.** Pick a release, and merge no schema changes while you squash. Check that each
   environment is current:
   `SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY 1 DESC LIMIT 1;`
   It must equal the newest migration in this folder.
2. **Back up** production (`pg_dump -Fc`) and keep a copy of this folder (it is in git history too).
3. **Capture the reference schema** from a database migrated with the current history:
   `pg_dump --schema-only --no-owner > before.sql`.
4. **Generate the baseline.** Delete every migration file and the snapshot, then run
   `dotnet ef migrations add InitialSchema`. It is generated from the current model, so it
   contains everything above. Add any hand-written SQL the old migrations ran (sequences,
   partial indexes, functions, seed rows written with `migrationBuilder.Sql`) to it. To find that
   SQL, search the old files for `Sql(`.
5. **Verify.** Apply `InitialSchema` to an empty database, `pg_dump --schema-only` it to
   `after.sql`, and diff it against `before.sql`. The two must match, apart from ordering. Run
   `dotnet test`. The model-diff test must pass.
6. **Re-point existing databases**, in one transaction per environment, without touching the schema:
   ```sql
   BEGIN;
   DELETE FROM "__EFMigrationsHistory";
   INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
   VALUES ('<timestamp>_InitialSchema', '9.0.0');
   COMMIT;
   ```
   Do this before deploying the squashed build, with `Database:MigrateOnStartup` off for that
   deploy or the migration lock held, so startup does not try to create the schema again.
7. **Deploy**, then re-enable `MigrateOnStartup`. New databases build from `InitialSchema`.
   Existing databases see no pending migrations.

From then on, follow the naming rules above.
