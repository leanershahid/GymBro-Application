// QA demo-data seeder (tools/qa/DemoSeeder).
//
//   dotnet run -- tenants                  read-only: list tenants (id, name, created, user count)
//   dotnet run -- swagger <outFile>        write the API's OpenAPI document (dev aid)
//   dotnet run -- seed --tenant <id>       seed demo data into that gym (re-runnable; manifest-driven)
//   dotnet run -- cleanup [--yes]          delete ONLY the rows listed in the manifest (dry run without --yes)
//
// Files (git-ignored): tools/qa/demo-seed-manifest.local.json, tools/qa/demo-credentials.local.json
using DemoSeeder;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

var qaDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
DemoApiFactory.PrepareEnvironment();
var cmd = args.FirstOrDefault() ?? "help";

await using var factory = new DemoApiFactory();
var http = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
Console.WriteLine($"API host started in-process; background jobs removed: {string.Join(", ", factory.RemovedHostedServices)}");

switch (cmd)
{
    case "tenants":
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await db.Tenants.AsNoTracking()
            .Select(t => new { t.Id, t.Name, t.CreatedAt, t.Status, Users = db.Users.Count(u => u.TenantId == t.Id && u.DeletedAt == null) })
            .OrderBy(t => t.Id).ToListAsync();
        foreach (var t in rows) Console.WriteLine($"tenant {t.Id} | {t.Name} | created {t.CreatedAt:yyyy-MM-dd} | {t.Status} | users {t.Users}");
        break;
    }
    case "inspect":
    {
        // Read-only overview of one gym (no secrets: setting KEYS only, never values).
        var tid = ulong.Parse(args[1]);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        foreach (var r in await db.Roles.AsNoTracking().Where(r => r.TenantId == tid).OrderBy(r => r.Id).ToListAsync())
            Console.WriteLine($"role {r.Id} {r.Slug} '{r.Name}' system={r.IsSystem} users={await db.Users.CountAsync(u => u.RoleId == r.Id && u.DeletedAt == null)}");
        foreach (var b in await db.Branches.AsNoTracking().Where(b => b.TenantId == tid).ToListAsync())
            Console.WriteLine($"branch {b.Id} '{b.Name}' {b.Status} tz={b.Timezone} hours={await db.BranchOpeningIntervals.CountAsync(i => i.BranchId == b.Id)} exceptions={await db.BranchHoursExceptions.CountAsync(i => i.BranchId == b.Id)} profile={await db.BranchProfiles.AnyAsync(i => i.BranchId == b.Id)}");
        Console.WriteLine($"settings keys: {string.Join(", ", await db.TenantSettings.Where(s => s.TenantId == tid).Select(s => s.Key).ToListAsync())}");
        Console.WriteLine($"waivers active={await db.WaiverDocuments.CountAsync(w => w.TenantId == tid && w.IsActive)} total={await db.WaiverDocuments.CountAsync(w => w.TenantId == tid)}");
        Console.WriteLine($"exercises tenant={await db.Exercises.CountAsync(e => e.TenantId == tid)} shared={await db.Exercises.CountAsync(e => e.TenantId == null)}");
        Console.WriteLine($"tags: {string.Join(", ", await db.Tags.Where(t => t.TenantId == tid).Select(t => t.Id + ":" + t.Name).ToListAsync())}");
        Console.WriteLine($"plans={await db.MembershipPlans.CountAsync(p => p.TenantId == tid)} classTypes={await db.ClassTypes.CountAsync(p => p.TenantId == tid)} classes={await db.GymClasses.CountAsync(p => p.TenantId == tid)} trainers={await db.TrainerProfiles.CountAsync(p => p.TenantId == tid)}");
        Console.WriteLine($"demo users already present: {await db.Users.CountAsync(u => u.Email != null && u.Email.EndsWith("@gymbro-demo.test"))}");
        Console.WriteLine($"payment gateways={await db.PaymentGateways.CountAsync()} shopProducts={await db.ShopProducts.CountAsync()} shopCategories={await db.ShopCategories.CountAsync()}");
        break;
    }
    case "modules":
    {
        // Read-only: module master rows in the DB vs ModuleCatalog in code.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var inDb = await db.Modules.Select(x => x.Key).ToListAsync();
        var inCode = GymManagmentApplication.Application.Access.ModuleCatalog.All.Select(x => x.Key).ToList();
        Console.WriteLine($"db={inDb.Count} code={inCode.Count}");
        Console.WriteLine("missing in db: " + string.Join(", ", inCode.Except(inDb)));
        Console.WriteLine("extra in db (would be pruned): " + string.Join(", ", inDb.Except(inCode)));
        break;
    }
    case "verify":
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var man = Manifest.Load(Path.Combine(qaDir, "demo-seed-manifest.local.json"));
        var problems = await Closure.VerifyItemsAsync(db, man);
        Console.WriteLine($"{man.Items.Count} items, {problems.Count} problems");
        foreach (var p in problems) Console.WriteLine("  " + p);
        break;
    }
    case "swagger":
    {
        var doc = await http.GetStringAsync("/swagger/v1/swagger.json");
        await File.WriteAllTextAsync(args[1], doc);
        Console.WriteLine($"wrote {doc.Length} chars");
        break;
    }
    case "seed":
    {
        var idx = Array.IndexOf(args, "--tenant");
        if (idx < 0 || idx + 1 >= args.Length) { Console.WriteLine("seed needs --tenant <id>"); return 2; }
        var seeder = new Seeder(factory, http, ulong.Parse(args[idx + 1]), qaDir);
        return await seeder.RunAsync();
    }
    case "cleanup":
        return await Cleanup.RunAsync(factory, qaDir, args.Contains("--yes"));
    default:
        Console.WriteLine("commands: tenants | swagger <file> | seed --tenant <id> | cleanup [--yes]");
        break;
}
return 0;
