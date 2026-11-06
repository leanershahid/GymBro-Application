using System.Collections.Concurrent;
using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore.ValueGeneration;

namespace GymManagmentApplication.Infrastructure.Data;

/// <summary>
/// ARCH-004: race-free ulong ids on Postgres. Each table with a single ulong "Id" key has its own
/// sequence ("{Table}_Id_hilo_seq", INCREMENT BY <see cref="BlockSize"/>, created by migration
/// IdSequences). One nextval() reserves the block [v, v + BlockSize), which is handed out in
/// memory, shared by every context in the process. Postgres sequences never return the same value
/// twice, so concurrent requests and multiple app instances can't collide.
///
/// Npgsql's built-in UseHiLo() refuses ulong properties, hence this small HiLo of our own. Like
/// the old MAX(Id)+1 scheme, the id is a real (not temporary) value assigned the moment the entity
/// is added, so code can read entity.Id before SaveChanges. Explicit ids are left alone by EF.
/// </summary>
public sealed class IdSequenceValueGenerator(string sequenceName) : ValueGenerator<ulong>
{
    /// <summary>Must equal the sequence's INCREMENT BY (see AppDbContext.UseIdSequences and the migration).</summary>
    public const int BlockSize = 10;

    private sealed class Block
    {
        public ulong Next;
        public ulong End; // exclusive
    }

    // Keyed by database + sequence so two databases in one process never share blocks.
    private static readonly ConcurrentDictionary<string, Block> Blocks = new();

    public override bool GeneratesTemporaryValues => false;

    public override ulong Next(EntityEntry entry)
    {
        var block = BlockFor(entry.Context);
        while (true)
        {
            if (TryTake(block, out var id)) return id;
            Refill(block, FetchLow(entry.Context));
        }
    }

    public override async ValueTask<ulong> NextAsync(EntityEntry entry, CancellationToken cancellationToken = default)
    {
        var block = BlockFor(entry.Context);
        while (true)
        {
            if (TryTake(block, out var id)) return id;
            Refill(block, await FetchLowAsync(entry.Context, cancellationToken));
        }
    }

    private Block BlockFor(DbContext context)
    {
        var conn = context.Database.GetDbConnection();
        var key = $"{conn.DataSource}|{conn.Database}|{sequenceName}";
        return Blocks.GetOrAdd(key, _ => new Block());
    }

    private static bool TryTake(Block block, out ulong id)
    {
        lock (block)
        {
            if (block.Next < block.End)
            {
                id = block.Next++;
                return true;
            }
        }
        id = 0;
        return false;
    }

    private static void Refill(Block block, ulong low)
    {
        lock (block)
        {
            // Another thread may have refilled meanwhile; then this block is simply skipped (a gap).
            if (block.Next >= block.End)
            {
                block.Next = low;
                block.End = low + BlockSize;
            }
        }
    }

    private string Sql => $"SELECT nextval('\"{sequenceName}\"')";

    private ulong FetchLow(DbContext context)
    {
        var conn = context.Database.GetDbConnection();
        var wasOpen = conn.State == ConnectionState.Open;
        if (!wasOpen) conn.Open();
        try
        {
            using var cmd = Command(context, conn);
            return checked((ulong)Convert.ToInt64(cmd.ExecuteScalar()));
        }
        finally
        {
            if (!wasOpen) conn.Close();
        }
    }

    private async Task<ulong> FetchLowAsync(DbContext context, CancellationToken cancellationToken)
    {
        var conn = context.Database.GetDbConnection();
        var wasOpen = conn.State == ConnectionState.Open;
        if (!wasOpen) await conn.OpenAsync(cancellationToken);
        try
        {
            await using var cmd = Command(context, conn);
            return checked((ulong)Convert.ToInt64(await cmd.ExecuteScalarAsync(cancellationToken)));
        }
        finally
        {
            if (!wasOpen) await conn.CloseAsync();
        }
    }

    private DbCommand Command(DbContext context, DbConnection conn)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = Sql;
        if (context.Database.CurrentTransaction is { } tx) cmd.Transaction = tx.GetDbTransaction();
        return cmd;
    }
}
