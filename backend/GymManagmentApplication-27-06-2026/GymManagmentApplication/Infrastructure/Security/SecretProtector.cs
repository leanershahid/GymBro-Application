using System.Security.Cryptography;
using System.Text;

namespace GymManagmentApplication.Infrastructure.Security;

/// <summary>
/// Encrypts small secrets stored in the database (payment-gateway keys, SSO client secrets)
/// with AES-256-GCM. The key comes from "Secrets:Key" (Secrets__Key env var); without it, one is
/// derived from the JWT signing key — set Secrets__Key in production so rotating the JWT key
/// doesn't make stored secrets unreadable.
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

    public SecretProtector(IConfiguration config)
    {
        var material = config["Secrets:Key"];
        if (string.IsNullOrWhiteSpace(material)) material = "gymbro-secrets|" + config["Jwt:Key"];
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(material));
    }

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
        try
        {
            var data = Convert.FromBase64String(protectedValue[Prefix.Length..]);
            var nonce = data[..12];
            var tag = data[12..28];
            var cipher = data[28..];
            var plain = new byte[cipher.Length];
            using var aes = new AesGcm(_key, 16);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch (Exception)
        {
            return null;
        }
    }
}
