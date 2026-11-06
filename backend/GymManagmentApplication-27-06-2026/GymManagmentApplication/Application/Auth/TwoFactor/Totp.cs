using System.Security.Cryptography;
using System.Text;

namespace GymManagmentApplication.Application.Auth.TwoFactor;

/// <summary>
/// Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP), as used by Google/Microsoft
/// Authenticator, 1Password, Authy…: 30-second steps, 6 digits, HMAC-SHA1, ±1 step of clock drift.
/// Pure functions on System.Security.Cryptography — no package.
/// </summary>
public static class Totp
{
    public const int StepSeconds = 30;
    public const int Digits = 6;
    /// <summary>Steps accepted either side of now (clock drift / slow typing).</summary>
    public const int Window = 1;
    /// <summary>160-bit secret, the size RFC 4226 recommends for HMAC-SHA1.</summary>
    public const int SecretBytes = 20;

    public enum Algorithm { Sha1, Sha256, Sha512 }

    public static byte[] NewSecret() => RandomNumberGenerator.GetBytes(SecretBytes);

    public static long TimeStep(DateTimeOffset at) => at.ToUnixTimeSeconds() / StepSeconds;

    /// <summary>The HOTP value of <paramref name="counter"/> (RFC 4226 §5.3 dynamic truncation).</summary>
    public static string Compute(byte[] key, long counter, int digits = Digits, Algorithm algorithm = Algorithm.Sha1)
    {
        Span<byte> msg = stackalloc byte[8];
        System.Buffers.Binary.BinaryPrimitives.WriteInt64BigEndian(msg, counter);
        byte[] hash = algorithm switch
        {
            Algorithm.Sha256 => HMACSHA256.HashData(key, msg),
            Algorithm.Sha512 => HMACSHA512.HashData(key, msg),
            _ => HMACSHA1.HashData(key, msg),
        };
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        var mod = (int)Math.Pow(10, digits);
        return (binary % mod).ToString(new string('0', digits));
    }

    /// <summary>
    /// The time step the code belongs to, if it matches now ±<paramref name="window"/> steps and is
    /// newer than <paramref name="lastUsedStep"/> (a code is accepted once — replays are rejected).
    /// </summary>
    public static long? Verify(byte[] key, string? code, DateTimeOffset now, long lastUsedStep = -1, int window = Window)
    {
        var normalized = Normalize(code);
        if (normalized.Length != Digits) return null;
        var expected = Encoding.ASCII.GetBytes(normalized);
        var current = TimeStep(now);
        long? match = null;
        // Check every step in the window (no early exit) so timing doesn't reveal which one matched.
        for (var step = current - window; step <= current + window; step++)
        {
            var candidate = Encoding.ASCII.GetBytes(Compute(key, step));
            if (CryptographicOperations.FixedTimeEquals(candidate, expected) && step > lastUsedStep && match is null)
                match = step;
        }
        return match;
    }

    /// <summary>Digits only ("123 456", "123-456" → "123456").</summary>
    public static string Normalize(string? code) =>
        new((code ?? string.Empty).Where(char.IsAsciiDigit).ToArray());

    /// <summary>The otpauth:// URI an authenticator app reads from the QR code (Key URI Format).</summary>
    public static string OtpAuthUri(string issuer, string account, string base32Secret) =>
        $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(account)}" +
        $"?secret={base32Secret}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits={Digits}&period={StepSeconds}";

    // ── Base32 (RFC 4648, no padding) — the secret format authenticator apps expect ──
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public static string ToBase32(byte[] data)
    {
        var sb = new StringBuilder((data.Length * 8 + 4) / 5);
        int buffer = 0, bits = 0;
        foreach (var b in data)
        {
            buffer = (buffer << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                sb.Append(Alphabet[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }
        if (bits > 0) sb.Append(Alphabet[(buffer << (5 - bits)) & 31]);
        return sb.ToString();
    }

    public static byte[] FromBase32(string text)
    {
        var clean = text.Trim().TrimEnd('=').Replace(" ", string.Empty).ToUpperInvariant();
        var output = new List<byte>(clean.Length * 5 / 8);
        int buffer = 0, bits = 0;
        foreach (var c in clean)
        {
            var v = Alphabet.IndexOf(c);
            if (v < 0) throw new FormatException("Invalid Base32 character.");
            buffer = (buffer << 5) | v;
            bits += 5;
            if (bits >= 8)
            {
                output.Add((byte)((buffer >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }
        return [.. output];
    }

    /// <summary>"JBSW Y3DP EHPK 3PXP" — easier to type into an app by hand.</summary>
    public static string Group(string base32) =>
        string.Join(' ', Enumerable.Range(0, (base32.Length + 3) / 4).Select(i => base32.Substring(i * 4, Math.Min(4, base32.Length - i * 4))));
}
