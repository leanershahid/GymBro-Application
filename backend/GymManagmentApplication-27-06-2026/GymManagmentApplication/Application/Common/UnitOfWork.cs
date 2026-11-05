using System.Data;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Common;

/// <summary>
/// One way to make a multi-step write atomic: the work runs inside the context's execution
/// strategy and a single transaction, and joins the caller's transaction when one is already
/// open. Keep external calls (payment gateways, email) out of <c>work</c> — the strategy may
/// run it again and a rollback can't undo them.
/// </summary>
public static class UnitOfWork
{
    public static async Task<T> InTransactionAsync<T>(this AppDbContext db, Func<Task<T>> work,
        IsolationLevel isolation = IsolationLevel.ReadCommitted, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is not null) return await work();

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(isolation, ct);
            var result = await work();
            await tx.CommitAsync(ct);
            return result;
        });
    }

    public static Task InTransactionAsync(this AppDbContext db, Func<Task> work,
        IsolationLevel isolation = IsolationLevel.ReadCommitted, CancellationToken ct = default) =>
        db.InTransactionAsync(async () => { await work(); return true; }, isolation, ct);

    /// <summary>
    /// Takes a row lock (<c>SELECT … FOR UPDATE</c>) on one row of <typeparamref name="TEntity"/>,
    /// so concurrent requests touching the same row (a class's capacity, an invoice's balance, a
    /// trainer's calendar) run one after the other until the surrounding transaction ends.
    /// </summary>
    public static async Task LockRowAsync<TEntity>(this AppDbContext db, ulong id, CancellationToken ct = default)
        where TEntity : class
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("LockRowAsync must run inside a transaction (use InTransactionAsync).");

        var type = db.Model.FindEntityType(typeof(TEntity))
                   ?? throw new InvalidOperationException($"{typeof(TEntity).Name} is not part of the model.");
        var table = type.GetTableName()!;
        var schema = type.GetSchema();
        var qualified = schema is null ? $"\"{table}\"" : $"\"{schema}\".\"{table}\"";
        var column = type.FindProperty("Id")?.GetColumnName(
            Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table, schema)) ?? "Id";

        // Table/column names come from the EF model, never from input; the id is a parameter.
#pragma warning disable EF1002
        await db.Database.ExecuteSqlRawAsync(
            $"SELECT 1 FROM {qualified} WHERE \"{column}\" = {{0}} FOR UPDATE", [(decimal)id], ct);
#pragma warning restore EF1002
    }
}
