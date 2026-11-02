namespace GymManagmentApplication.Infrastructure;

/// <summary>
/// Loads a local <c>.env</c> file into environment variables before the app reads its
/// configuration. ASP.NET maps <c>Section__Key</c> to <c>Section:Key</c>, so
/// <c>Storage__CloudinaryApiKey=…</c> fills <c>Storage:CloudinaryApiKey</c>.
/// Variables already set (e.g. on Render) win over the file; a missing file is fine.
/// </summary>
public static class DotEnv
{
    public static void Load(string path)
    {
        if (!File.Exists(path)) return;

        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            if (line.StartsWith("export ", StringComparison.Ordinal)) line = line[7..].TrimStart();

            var eq = line.IndexOf('=');
            if (eq <= 0) continue;
            var key = line[..eq].Trim();
            var value = line[(eq + 1)..].Trim();
            if (value.Length >= 2 && (value[0] == '"' && value[^1] == '"' || value[0] == '\'' && value[^1] == '\''))
                value = value[1..^1];

            if (Environment.GetEnvironmentVariable(key) is null)
                Environment.SetEnvironmentVariable(key, value);
        }
    }
}
