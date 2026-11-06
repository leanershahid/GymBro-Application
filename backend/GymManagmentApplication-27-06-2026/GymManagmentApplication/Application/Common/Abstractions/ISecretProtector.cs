namespace GymManagmentApplication.Application.Common;

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
