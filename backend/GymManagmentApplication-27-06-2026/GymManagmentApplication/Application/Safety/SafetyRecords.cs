using System.Text.Json;
using System.Text.RegularExpressions;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Safety;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Safety;

/// <summary>
/// Structured emergency contacts with a read-through fallback to the legacy free-form
/// <c>ClientProfile.EmergencyContact</c> JSON (kept, never rewritten). The first save of the new
/// form creates the structured row; from then on it wins.
/// </summary>
public static partial class EmergencyContacts
{
    public static async Task<EmergencyContactResponse?> GetAsync(IAppDbContext db, ulong tenantId, ulong userId)
    {
        var row = await db.MemberEmergencyContacts.AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.UserId == userId);
        if (row is not null)
            return new EmergencyContactResponse { Name = row.Name, Relationship = row.Relationship, Phone = row.Phone, Source = "profile", UpdatedAt = row.UpdatedAt };

        var legacy = await db.ClientProfiles.AsNoTracking()
            .Where(p => p.UserId == userId && p.EmergencyContact != null)
            .Select(p => p.EmergencyContact).FirstOrDefaultAsync();
        return FromLegacy(legacy);
    }

    /// <summary>
    /// Reads the old field: an object ({ name, relationship|relation, phone|phoneNumber|mobile }),
    /// or a plain string such as "Priya Shah (sister) +91 98765 43210". Null when no phone can be found.
    /// </summary>
    public static EmergencyContactResponse? FromLegacy(JsonDocument? doc)
    {
        if (doc is null) return null;
        var root = doc.RootElement;
        string? name = null, relation = null, phone = null;
        if (root.ValueKind == JsonValueKind.Object)
        {
            name = Str(root, "name", "fullName", "contactName");
            relation = Str(root, "relationship", "relation");
            phone = Str(root, "phone", "phoneNumber", "mobile", "number");
            if (phone is null && Str(root, "value", "text") is { } text) (name, relation, phone) = ParseText(text);
        }
        else if (root.ValueKind == JsonValueKind.String && root.GetString() is { } text)
        {
            (name, relation, phone) = ParseText(text);
        }
        if (string.IsNullOrWhiteSpace(phone)) return null;
        return new EmergencyContactResponse
        {
            Name = string.IsNullOrWhiteSpace(name) ? "Emergency contact" : name.Trim(),
            Relationship = string.IsNullOrWhiteSpace(relation) ? null : relation.Trim(),
            Phone = phone.Trim(), Source = "legacy",
        };
    }

    private static string? Str(JsonElement o, params string[] keys)
    {
        foreach (var p in o.EnumerateObject())
            if (keys.Any(k => k.Equals(p.Name, StringComparison.OrdinalIgnoreCase)) && p.Value.ValueKind == JsonValueKind.String)
                return p.Value.GetString();
        return null;
    }

    internal static (string? Name, string? Relation, string? Phone) ParseText(string text)
    {
        var phoneMatch = PhoneRegex().Match(text);
        if (!phoneMatch.Success) return (text.Trim(), null, null);
        var rest = (text[..phoneMatch.Index] + text[(phoneMatch.Index + phoneMatch.Length)..]).Trim();
        string? relation = null;
        var rel = RelationRegex().Match(rest);
        if (rel.Success)
        {
            relation = rel.Groups[1].Value.Trim();
            rest = rest.Remove(rel.Index, rel.Length).Trim();
        }
        rest = rest.Trim(' ', '-', ',', ':', '–');
        return (rest.Length > 0 ? rest : null, relation, phoneMatch.Value.Trim());
    }

    public static string NormalizePhone(string phone)
    {
        var trimmed = phone.Trim();
        var digits = trimmed.Count(char.IsDigit);
        if (digits is < 6 or > 15) throw new ArgumentException("Phone: enter a valid phone number (6–15 digits).");
        if (trimmed.Any(ch => !(char.IsDigit(ch) || ch is ' ' or '+' or '-' or '(' or ')' or '.')))
            throw new ArgumentException("Phone: only digits, spaces and + - ( ) are allowed.");
        return trimmed;
    }

    [GeneratedRegex(@"\+?\d[\d\s\-().]{5,}\d")]
    private static partial Regex PhoneRegex();

    [GeneratedRegex(@"\(([^)]{1,40})\)")]
    private static partial Regex RelationRegex();
}

/// <summary>Consent lookups shared by the gate and the consent endpoints.</summary>
public static class Consents
{
    /// <summary>The latest record for the type decides; no record = not granted.</summary>
    public static async Task<bool> IsGrantedAsync(IAppDbContext db, ulong tenantId, ulong userId, string type) =>
        await db.ConsentRecords.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.UserId == userId && c.Type == type)
            .OrderByDescending(c => c.At)
            .Select(c => (bool?)c.Granted).FirstOrDefaultAsync() ?? false;

    public static readonly string[] Sources = ["app", "web", "desk", "signup", "health_form", "import"];
}
