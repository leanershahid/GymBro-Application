using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Tests;

/// <summary>
/// ARCH-022 / ARCH-097: the Application layer depends on abstractions it owns (IAppDbContext,
/// IFileStorage, IEmailSender, ISecretProtector, IRazorpayClient, repository interfaces), never on
/// <c>GymManagmentApplication.Infrastructure.*</c>, and its service contracts carry no HTTP types.
/// Everything is one project, so the rule is enforced here instead of by project references.
/// </summary>
public class LayeringTests
{
    private const string AppNs = "GymManagmentApplication.Application";
    private const string InfraNs = "GymManagmentApplication.Infrastructure";

    /// <summary>
    /// Application files still allowed to mention Infrastructure, with the reason. Keep it empty;
    /// add an entry only for a dependency that would take a large rewrite to remove.
    /// </summary>
    private static readonly Dictionary<string, string> SourceAllowlist = new(StringComparer.OrdinalIgnoreCase)
    {
    };

    // A namespace reference to our Infrastructure layer: "using GymManagmentApplication.Infrastructure.X",
    // a fully-qualified name, or the relative "Infrastructure.X" form that resolves to it from inside
    // GymManagmentApplication.*. Microsoft.EntityFrameworkCore.Infrastructure is not matched.
    private static readonly Regex InfraReference = new(
        @"(?<![\w.])(GymManagmentApplication\.)?Infrastructure\.(Data|Email|Storage|Payments|Security|Repositories|Jobs|Json|Http)\b|\bGymManagmentApplication\.Infrastructure\b",
        RegexOptions.Compiled);

    private static string ApplicationSourceDir([CallerFilePath] string thisFile = "") =>
        Path.GetFullPath(Path.Combine(Path.GetDirectoryName(thisFile)!, "..", "GymManagmentApplication", "Application"));

    [Fact]
    public void Application_source_does_not_reference_Infrastructure_namespaces()
    {
        var dir = ApplicationSourceDir();
        Assert.True(Directory.Exists(dir), $"Application source folder not found at {dir}");

        var offences = new List<string>();
        foreach (var file in Directory.EnumerateFiles(dir, "*.cs", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(dir, file).Replace('\\', '/');
            if (SourceAllowlist.ContainsKey(relative)) continue;
            var lines = File.ReadAllLines(file);
            for (var i = 0; i < lines.Length; i++)
            {
                var line = lines[i].TrimStart();
                if (line.StartsWith("//", StringComparison.Ordinal)) continue; // comments and XML docs
                if (InfraReference.IsMatch(line)) offences.Add($"Application/{relative}:{i + 1}: {line}");
            }
        }
        Assert.True(offences.Count == 0,
            "Application must not reference GymManagmentApplication.Infrastructure (ARCH-022). Depend on an " +
            "Application abstraction instead, or add the file to SourceAllowlist with a reason:\n" + string.Join("\n", offences));
    }

    [Fact]
    public void Application_types_do_not_expose_or_store_Infrastructure_types()
    {
        var offences = new List<string>();
        foreach (var type in ApplicationTypes())
        {
            const BindingFlags all = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;
            if (type.BaseType is { } b && IsInfra(b)) offences.Add($"{type}: base {b}");
            offences.AddRange(type.GetInterfaces().Where(IsInfra).Select(i => $"{type}: implements {i}"));
            offences.AddRange(type.GetFields(all).Where(f => IsInfra(f.FieldType)).Select(f => $"{type}.{f.Name}: {f.FieldType}"));
            offences.AddRange(type.GetProperties(all).Where(p => IsInfra(p.PropertyType)).Select(p => $"{type}.{p.Name}: {p.PropertyType}"));
            foreach (var m in type.GetMethods(all).Cast<MethodBase>().Concat(type.GetConstructors(all)))
            {
                if (m is MethodInfo mi && IsInfra(mi.ReturnType)) offences.Add($"{type}.{m.Name}: returns {mi.ReturnType}");
                offences.AddRange(m.GetParameters().Where(p => IsInfra(p.ParameterType)).Select(p => $"{type}.{m.Name}({p.Name}): {p.ParameterType}"));
            }
        }
        Assert.True(offences.Count == 0, "Application types use Infrastructure types (ARCH-022):\n" + string.Join("\n", offences.Distinct()));
    }

    [Fact]
    public void Application_contracts_do_not_take_IFormFile()
    {
        var offences = new List<string>();
        foreach (var type in ApplicationTypes())
        {
            const BindingFlags pub = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;
            offences.AddRange(type.GetProperties(pub).Where(p => IsFormFile(p.PropertyType)).Select(p => $"{type}.{p.Name}"));
            foreach (var m in type.GetMethods(pub))
                offences.AddRange(m.GetParameters().Where(p => IsFormFile(p.ParameterType)).Select(p => $"{type}.{m.Name}({p.Name})"));
        }
        Assert.True(offences.Count == 0, $"Use {nameof(FileUpload)} instead of IFormFile in Application (ARCH-097):\n" + string.Join("\n", offences));
    }

    [Fact]
    public void FileUpload_can_be_reopened()
    {
        var upload = FileUpload.FromBytes("a.txt", "text/plain", [1, 2, 3]);
        using (var first = upload.OpenReadStream()) Assert.Equal(1, first.ReadByte());
        using var second = upload.OpenReadStream();
        Assert.Equal(1, second.ReadByte());
        Assert.Equal(3, upload.Length);
    }

    private static IEnumerable<Type> ApplicationTypes() =>
        typeof(IAppDbContext).Assembly.GetTypes().Where(t => t.Namespace?.StartsWith(AppNs, StringComparison.Ordinal) == true);

    private static bool IsInfra(Type t) => Mentions(t, x => x.Namespace?.StartsWith(InfraNs, StringComparison.Ordinal) == true);

    private static bool IsFormFile(Type t) => Mentions(t, x => x.FullName == "Microsoft.AspNetCore.Http.IFormFile");

    /// <summary>The type itself, its element type, or any generic argument (Task&lt;T&gt;, List&lt;T&gt;…).</summary>
    private static bool Mentions(Type t, Func<Type, bool> match)
    {
        if (t.HasElementType) return Mentions(t.GetElementType()!, match);
        if (match(t)) return true;
        return t.IsGenericType && t.GetGenericArguments().Any(a => !a.IsGenericParameter && Mentions(a, match));
    }
}
