using System.Data.Common;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;

namespace DemoSeeder;

/// <summary>
/// Finds every row that depends on the seeded records (FK closure over the EF model), and deletes
/// exactly the manifest's rows in a safe order. Nothing outside the manifest is touched.
/// </summary>
public static class Closure
{
    /// <summary>Loose (non-FK) user-reference columns, matched only on rows created since the first seed run.</summary>
    private static bool IsLooseUserColumn(string name) =>
        name is "UserId" or "ClientId" or "MemberId" or "CreatedBy" or "UpdatedBy" or "ActorId" or "AuthorId" or "SenderId" or "RecipientId"
        || name.EndsWith("UserId", StringComparison.Ordinal);

    private static string Q(string ident) => "\"" + ident.Replace("\"", "\"\"") + "\"";
    private static string Table(IEntityType et) => (et.GetSchema() is { } s ? Q(s) + "." : "") + Q(et.GetTableName()!);
    private static string Col(IEntityType et, IProperty p) =>
        Q(p.GetColumnName(StoreObjectIdentifier.Table(et.GetTableName()!, et.GetSchema()))!);

    public static IEnumerable<IEntityType> Tables(DbContext db) =>
        db.Model.GetEntityTypes().Where(e => !e.IsOwned() && e.FindPrimaryKey() is not null && e.GetTableName() is not null && e.BaseType is null);

    private static bool IsNumericKey(IProperty p) => p.ClrType == typeof(ulong) || p.ClrType == typeof(long) || p.ClrType == typeof(int) || p.ClrType == typeof(uint);

    /// <summary>Recomputes manifest.Derived: all rows (transitively) referencing the manifest's Items.</summary>
    public static async Task<Dictionary<string, int>> ComputeAsync(AppDbContext db, Manifest m)
    {
        var byName = Tables(db).ToDictionary(e => e.ClrType.Name);
        // entity → set of key strings (single key: the id; composite: "c1=v1|c2=v2")
        var rows = new Dictionary<IEntityType, Dictionary<string, DerivedRow>>();
        var demoUsers = new HashSet<decimal>();

        void Add(IEntityType et, DerivedRow r)
        {
            if (!rows.TryGetValue(et, out var set)) rows[et] = set = [];
            var k = string.Join("|", r.Key.OrderBy(x => x.Key).Select(x => x.Key + "=" + x.Value));
            set.TryAdd(k, r);
        }

        foreach (var (key, item) in m.Items)
        {
            if (!byName.TryGetValue(item.Entity, out var et)) throw new InvalidOperationException($"Unknown entity '{item.Entity}' for '{key}'.");
            var pk = et.FindPrimaryKey()!.Properties.Single();
            Add(et, new DerivedRow { Entity = item.Entity, Key = new() { [pk.Name] = item.Id.ToString() }, Via = "item:" + key });
            if (item.Entity == "User") demoUsers.Add(item.Id);
        }

        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        var since = m.FirstRunAt.AddMinutes(-2);

        for (var pass = 0; pass < 25; pass++)
        {
            var before = rows.Sum(r => r.Value.Count);
            foreach (var dep in Tables(db))
            {
                var pkProps = dep.FindPrimaryKey()!.Properties;
                foreach (var fk in dep.GetForeignKeys().Where(f => f.Properties.Count == 1))
                {
                    var principal = fk.PrincipalEntityType.GetRootType();
                    if (!rows.TryGetValue(principal, out var pRows) || pRows.Count == 0) continue;
                    var pPk = principal.FindPrimaryKey()!.Properties;
                    if (pPk.Count != 1 || !IsNumericKey(pPk[0]) || fk.PrincipalKey.Properties.Single() != pPk[0]) continue;
                    var ids = pRows.Values.Select(r => decimal.Parse(r.Key[pPk[0].Name])).Distinct().ToArray();
                    await QueryAsync(conn, dep, pkProps, $"{Col(dep, fk.Properties[0])} = ANY(@ids)", ids, null,
                        r => Add(dep, new DerivedRow { Entity = dep.ClrType.Name, Key = r, Via = $"fk:{dep.ClrType.Name}.{fk.Properties[0].Name}->{principal.ClrType.Name}" }));
                }

                // Loose user references (no FK configured): only this gym's rows created since the first run.
                var tenantProp = dep.FindProperty("TenantId");
                var createdProp = dep.FindProperty("CreatedAt");
                if (tenantProp is null || createdProp is null || demoUsers.Count == 0) continue;
                foreach (var p in dep.GetProperties().Where(p => IsLooseUserColumn(p.Name) && (p.ClrType == typeof(ulong) || p.ClrType == typeof(ulong?))
                                                                 && !p.GetContainingForeignKeys().Any()))
                {
                    await QueryAsync(conn, dep, pkProps,
                        $"{Col(dep, p)} = ANY(@ids) AND {Col(dep, tenantProp)} = @tenant AND {Col(dep, createdProp)} >= @since",
                        demoUsers.ToArray(), (m.TenantId, since),
                        r => Add(dep, new DerivedRow { Entity = dep.ClrType.Name, Key = r, Via = $"loose:{dep.ClrType.Name}.{p.Name}" }));
                }
            }
            if (rows.Sum(r => r.Value.Count) == before) break;
        }

        var itemKeys = m.Items.Values.Select(i => i.Entity + ":" + i.Id).ToHashSet();
        m.Derived = rows.SelectMany(r => r.Value.Values)
            .Where(r => !(r.Key.Count == 1 && itemKeys.Contains(r.Entity + ":" + r.Key.Values.First())))
            .OrderBy(r => r.Entity).ThenBy(r => string.Join(",", r.Key.Values)).ToList();
        return rows.ToDictionary(r => r.Key.ClrType.Name, r => r.Value.Count);
    }

    private static async Task QueryAsync(DbConnection conn, IEntityType et, IReadOnlyList<IProperty> pk, string where, decimal[] ids,
        (ulong tenant, DateTime since)? extra, Action<Dictionary<string, string>> onRow)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT {string.Join(", ", pk.Select(p => Col(et, p) + "::text"))} FROM {Table(et)} WHERE {where}";
        var p1 = cmd.CreateParameter(); p1.ParameterName = "ids"; p1.Value = ids; cmd.Parameters.Add(p1);
        if (extra is { } x)
        {
            var p2 = cmd.CreateParameter(); p2.ParameterName = "tenant"; p2.Value = (decimal)x.tenant; cmd.Parameters.Add(p2);
            var p3 = cmd.CreateParameter(); p3.ParameterName = "since"; p3.Value = DateTime.SpecifyKind(x.since, DateTimeKind.Utc); cmd.Parameters.Add(p3);
        }
        await using var rd = await cmd.ExecuteReaderAsync();
        while (await rd.ReadAsync())
            onRow(pk.Select((p, i) => (p.Name, rd.GetString(i))).ToDictionary(t => t.Name, t => t.Item2));
    }

    /// <summary>
    /// Safety check: every manifest item must exist and (where the table has CreatedAt) have been
    /// created since the first seed run. Returns the problems (empty = OK).
    /// </summary>
    public static async Task<List<string>> VerifyItemsAsync(AppDbContext db, Manifest m)
    {
        var problems = new List<string>();
        var byName = Tables(db).ToDictionary(e => e.ClrType.Name);
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        foreach (var (key, item) in m.Items)
        {
            var et = byName[item.Entity];
            var pk = et.FindPrimaryKey()!.Properties.Single();
            var created = et.FindProperty("CreatedAt");
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT {(created is null ? "NULL" : Col(et, created))} FROM {Table(et)} WHERE {Col(et, pk)} = @id";
            var p = cmd.CreateParameter(); p.ParameterName = "id"; p.Value = (decimal)item.Id; cmd.Parameters.Add(p);
            var tp = et.FindProperty("TenantId");
            if (tp is not null)
            {
                cmd.CommandText += $" AND ({Col(et, tp)} = @tenant OR {Col(et, tp)} IS NULL)";
                var t = cmd.CreateParameter(); t.ParameterName = "tenant"; t.Value = (decimal)m.TenantId; cmd.Parameters.Add(t);
            }
            await using var rd = await cmd.ExecuteReaderAsync();
            if (!await rd.ReadAsync()) { problems.Add($"{key}: {item.Entity} {item.Id} not found in this gym"); continue; }
            if (created is not null && !rd.IsDBNull(0) && rd.GetDateTime(0) < m.FirstRunAt.AddMinutes(-2))
                problems.Add($"{key}: {item.Entity} {item.Id} was created {rd.GetDateTime(0):u}, before the first seed run — NOT a demo row");
        }
        return problems;
    }

    /// <summary>All manifest rows (items + derived) grouped by entity.</summary>
    public static Dictionary<IEntityType, List<Dictionary<string, string>>> AllRows(DbContext db, Manifest m)
    {
        var byName = Tables(db).ToDictionary(e => e.ClrType.Name);
        var result = new Dictionary<IEntityType, List<Dictionary<string, string>>>();
        foreach (var i in m.Items.Values)
        {
            var et = byName[i.Entity];
            Get(et).Add(new() { [et.FindPrimaryKey()!.Properties.Single().Name] = i.Id.ToString() });
        }
        foreach (var d in m.Derived) Get(byName[d.Entity]).Add(d.Key);
        return result;
        List<Dictionary<string, string>> Get(IEntityType et) => result.TryGetValue(et, out var l) ? l : result[et] = [];
    }

    /// <summary>Deletes exactly the given rows: nulls their nullable FKs into the set (breaks cycles), then deletes dependents first.</summary>
    public static async Task<List<string>> DeleteAsync(AppDbContext db, Dictionary<IEntityType, List<Dictionary<string, string>>> rows, bool execute)
    {
        var log = new List<string>();
        var types = rows.Keys.ToHashSet();
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var tx = execute ? await conn.BeginTransactionAsync() : null;

        string KeyWhere(IEntityType et, DbCommand cmd, List<Dictionary<string, string>> keys)
        {
            var pk = et.FindPrimaryKey()!.Properties;
            if (pk.Count == 1 && IsNumericKey(pk[0]))
            {
                var p = cmd.CreateParameter(); p.ParameterName = "ids";
                p.Value = keys.Select(k => decimal.Parse(k[pk[0].Name])).Distinct().ToArray(); cmd.Parameters.Add(p);
                return $"{Col(et, pk[0])} = ANY(@ids)";
            }
            var tuples = new List<string>();
            var n = 0;
            foreach (var k in keys)
            {
                var parts = new List<string>();
                foreach (var prop in pk)
                {
                    var p = cmd.CreateParameter(); p.ParameterName = "k" + n++; p.Value = k[prop.Name]; cmd.Parameters.Add(p);
                    parts.Add($"{Col(et, prop)}::text = @{p.ParameterName}");
                }
                tuples.Add("(" + string.Join(" AND ", parts) + ")");
            }
            return string.Join(" OR ", tuples);
        }

        // 1) Null nullable FKs that point at rows we delete (cycles such as plan day <-> its workout).
        foreach (var et in types)
            foreach (var fk in et.GetForeignKeys().Where(f => f.Properties.Count == 1 && f.Properties[0].IsNullable && types.Contains(f.PrincipalEntityType.GetRootType())))
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = $"UPDATE {Table(et)} SET {Col(et, fk.Properties[0])} = NULL WHERE {KeyWhere(et, cmd, rows[et])}";
                if (execute) await cmd.ExecuteNonQueryAsync();
            }

        // 2) Delete in dependency order (required FKs only remain).
        var remaining = types.ToHashSet();
        while (remaining.Count > 0)
        {
            var leaf = remaining.FirstOrDefault(t => !remaining.Any(other => other != t && other.GetForeignKeys()
                .Any(f => f.PrincipalEntityType.GetRootType() == t && !(f.Properties.Count == 1 && f.Properties[0].IsNullable))));
            leaf ??= remaining.First(); // self-reference / unexpected cycle: one statement handles self-refs
            await using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = $"DELETE FROM {Table(leaf)} WHERE {KeyWhere(leaf, cmd, rows[leaf])}";
            var n = execute ? await cmd.ExecuteNonQueryAsync() : rows[leaf].Count;
            log.Add($"{(execute ? "deleted" : "would delete")} {n,4} from {leaf.GetTableName()} ({leaf.ClrType.Name})");
            remaining.Remove(leaf);
        }
        if (tx is not null) await tx.CommitAsync();
        return log;
    }
}

public static class Cleanup
{
    public static async Task<int> RunAsync(DemoApiFactory factory, string qaDir, bool yes)
    {
        var m = Manifest.Load(Path.Combine(qaDir, "demo-seed-manifest.local.json"));
        if (m.Items.Count == 0) { Console.WriteLine("Manifest is empty; nothing to delete."); return 0; }
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var problems = await Closure.VerifyItemsAsync(db, m);
        if (problems.Count > 0)
        {
            Console.WriteLine("Refusing to clean up: some manifest items do not look like demo rows:");
            foreach (var p in problems) Console.WriteLine("  " + p);
            return 4;
        }

        // Rows created after seeding (e.g. a demo user signed in again) are found again here and listed.
        var before = m.Derived.Count;
        var counts = await Closure.ComputeAsync(db, m);
        Console.WriteLine($"Manifest: {m.Items.Count} items, {m.Derived.Count} derived rows (was {before} at seed time).");
        var rows = Closure.AllRows(db, m);
        var log = await Closure.DeleteAsync(db, rows, execute: yes);
        foreach (var l in log) Console.WriteLine("  " + l);
        if (!yes) { Console.WriteLine("Dry run. Re-run with --yes to delete these rows (one transaction)."); return 0; }
        m.Notes.Add($"{DateTime.UtcNow:u} cleanup deleted all manifest rows.");
        m.Items.Clear(); m.Derived.Clear(); m.Steps.Clear();
        m.Save();
        Console.WriteLine("Done. Manifest cleared (credentials file left in place; delete it by hand).");
        return 0;
    }
}
