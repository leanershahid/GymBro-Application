using System.Security.Cryptography;
using System.Text;

namespace GymManagmentApplication.Infrastructure.Security;

/// <summary>
/// Encrypts small secrets stored in the database (payment-gateway keys, SSO client secrets)
/// with AES-256-GCM. The key comes from "Secrets:Key" (Secrets__Key env var).
/// <list type="bullet">
/// <item>Production: Secrets:Key is required — startup fails without it (no silent fallback).</item>
/// <item>Elsewhere: without it a key is derived from the JWT signing key, with a warning.</item>
/// <item>Decryption also tries the legacy JWT-derived key, so values stored before Secrets__Key was
/// set stay readable (and are re-encrypted with the new key the next time they are saved).
/// To keep that working, don't rotate Jwt__Key until those secrets have been re-saved.</item>
/// </list>
/// </summary>
public interface ISecretProtector
{
    string Protect(string plaintext);
    /// <summary>Null when the value can't be decrypted (wrong key, tampered, or not protected).</summary>
    string? Unprotect(string? protectedValue);
}

public class SecretProtector : ISecretProtector
{
    private const string Prefix = "enc1:";
    private readonly byte[] _key;
    private readonly byte[]? _legacyKey;

    /// <summary>Non-production behaviour (tests, tools): falls back to the JWT-derived key.</summary>
    public SecretProtector(IConfiguration config) : this(config, null, null) { }

    public SecretProtector(IConfiguration config, IHostEnvironment? env, ILogger<SecretProtector>? logger)
    {
        var jwtKey = config["Jwt:Key"];
        _legacyKey = string.IsNullOrWhiteSpace(jwtKey) ? null : Derive("gymbro-secrets|" + jwtKey);

        var material = config["Secrets:Key"];
        if (string.IsNullOrWhiteSpace(material))
        {
            if (env?.IsProduction() == true)
                throw new InvalidOperationException(
                    "Secrets:Key (env var Secrets__Key) must be set in Production. It encrypts stored gateway/SSO secrets. " +
                    "Values saved before it was set remain readable through the legacy JWT-derived key.");
            logger?.LogWarning("Secrets:Key is not set; stored secrets are encrypted with a key derived from Jwt:Key. Set Secrets__Key outside development.");
            _key = _legacyKey ?? throw new InvalidOperationException("Neither Secrets:Key nor Jwt:Key is configured.");
            _legacyKey = null;
        }
        else
        {
            _key = Derive(material);
        }
    }

    private static byte[] Derive(string material) => SHA256.HashData(Encoding.UTF8.GetBytes(material));

    public string Protect(string plaintext)
    {
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plain = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, plain, cipher, tag);
        return Prefix + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string? Unprotect(string? protectedValue)
    {
        if (string.IsNullOrEmpty(protectedValue) || !protectedValue.StartsWith(Prefix, StringComparison.Ordinal)) return null;
        return Decrypt(protectedValue, _key) ?? (_legacyKey is null ? null : Decrypt(protectedValue, _legacyKey));
    }

    private static string? Decrypt(string protectedValue, byte[] key)
    {
        try
        {
            var data = Convert.FromBase64String(protectedValue[Prefix.Length..]);
            var nonce = data[..12];
            var tag = data[12..28];
            var cipher = data[28..];
            var plain = new byte[cipher.Length];
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch (Exception)
        {
            return null;
        }
    }
}
