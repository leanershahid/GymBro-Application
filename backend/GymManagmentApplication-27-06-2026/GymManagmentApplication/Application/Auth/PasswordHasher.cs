using System.Security.Cryptography;
using System.Text;

namespace GymManagmentApplication.Application.Auth;

/// <summary>
/// Salted PBKDF2-SHA256 password hashing. Stored format: <c>pbkdf2$&lt;iterations&gt;$&lt;salt&gt;$&lt;hash&gt;</c>.
/// Legacy unsalted SHA-256 hex hashes still verify and are flagged for re-hashing on next login.
/// </summary>
public static class PasswordHasher
{
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const string Prefix = "pbkdf2";

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"{Prefix}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string? stored, out bool needsRehash)
    {
        needsRehash = false;
        if (string.IsNullOrEmpty(stored)) return false;

        var parts = stored.Split('$');
        if (parts.Length == 4 && parts[0] == Prefix && int.TryParse(parts[1], out var iterations))
        {
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            needsRehash = iterations < Iterations;
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }

        // Legacy: unsalted SHA-256 hex.
        var legacy = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(password)));
        var ok = CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(legacy), Encoding.ASCII.GetBytes(stored));
        needsRehash = ok;
        return ok;
    }

    /// <summary>Random one-time password for staff-created accounts (shown once to the creator).</summary>
    public static string GenerateTemporary()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        var chars = new char[10];
        for (var i = 0; i < chars.Length; i++)
            chars[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        // Guarantee the mix most password policies want.
        return new string(chars) + "!" + RandomNumberGenerator.GetInt32(10);
    }
}
