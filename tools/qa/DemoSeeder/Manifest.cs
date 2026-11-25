using System.Text.Json;
using System.Text.Json.Serialization;

namespace DemoSeeder;

/// <summary>One created row: the EF entity (CLR type name) and its primary key.</summary>
public sealed record Item(string Entity, ulong Id);

/// <summary>A dependent row found by the FK closure (single-column key, or a composite key as column → value).</summary>
public sealed class DerivedRow
{
    public string Entity { get; set; } = "";
    public Dictionary<string, string> Key { get; set; } = [];
    public string Via { get; set; } = "";
}

/// <summary>tools/qa/demo-seed-manifest.local.json — every record the seeder created (git-ignored).</summary>
public sealed class Manifest
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    public DateTime FirstRunAt { get; set; }
    public DateTime LastRunAt { get; set; }
    /// <summary>Records created directly by the seeder or returned by the API, by logical key.</summary>
    public Dictionary<string, Item> Items { get; set; } = [];
    /// <summary>Step → "done" | "skipped: …" | "error: …".</summary>
    public Dictionary<string, string> Steps { get; set; } = [];
    public List<string> Notes { get; set; } = [];
    /// <summary>Rows the API flows created as a side effect (bookings, invoices, sessions, logs…), found by FK closure.</summary>
    public List<DerivedRow> Derived { get; set; } = [];

    [JsonIgnore] public string Path { get; set; } = "";

    public static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static Manifest Load(string path)
    {
        var m = File.Exists(path) ? JsonSerializer.Deserialize<Manifest>(File.ReadAllText(path), Json) ?? new() : new Manifest();
        m.Path = path;
        return m;
    }

    public void Save() => File.WriteAllText(Path, JsonSerializer.Serialize(this, Json));

    public ulong? Get(string key) => Items.TryGetValue(key, out var i) ? i.Id : null;
    public ulong Id(string key) => Get(key) ?? throw new InvalidOperationException($"Manifest has no '{key}' (an earlier step failed).");
    public void Put(string key, string entity, ulong id) { Items[key] = new Item(entity, id); Save(); }
}

/// <summary>tools/qa/demo-credentials.local.json — generated sign-ins for the demo accounts (git-ignored, never printed).</summary>
public sealed class Credentials
{
    public sealed class Account
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
        public string Role { get; set; } = "";
        public ulong UserId { get; set; }
        public string? TotpSecret { get; set; }
        public List<string>? RecoveryCodes { get; set; }
    }

    public string Note { get; set; } = "Demo accounts seeded by tools/qa/DemoSeeder. Local only, never commit or share.";
    public Dictionary<string, Account> Accounts { get; set; } = [];
    [JsonIgnore] public string Path { get; set; } = "";

    public static Credentials Load(string path)
    {
        var c = File.Exists(path) ? JsonSerializer.Deserialize<Credentials>(File.ReadAllText(path), Manifest.Json) ?? new() : new Credentials();
        c.Path = path;
        return c;
    }

    public void Save() => File.WriteAllText(Path, JsonSerializer.Serialize(this, Manifest.Json));

    public static string NewPassword()
    {
        // 20 chars from a 64-char alphabet + guaranteed classes; meets any length/complexity rule.
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!.#$";
        var bytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(20);
        var core = new string(bytes.Select(b => alphabet[b % alphabet.Length]).ToArray());
        return "Dm" + core + "7!a";
    }
}
