using System.Reflection;
using System.Security.Claims;
using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Facilities;
using GymManagmentApplication.Application.Operations;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Controllers;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Facilities;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Filters;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace GymManagmentApplication.Tests;

/// <summary>Equipment register, problem reports and the incident log (roadmap feature 7).</summary>
public class FacilitiesTests : IDisposable
{
    private readonly TestDb _db = new();
    private const ulong Admin = 1, Staff = 2, OtherGymAdmin = 3, Member = 100, OtherMember = 101, OtherGymMember = 200;
    private const ulong Branch = 11, OtherGymBranch = 21;
    private static readonly RequestMeta Meta = new("10.0.0.1", "xunit");
    private ulong _treadmill, _pool, _otherGymAsset;

    public FacilitiesTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        using (var seed = _db.Create(null))
        {
            seed.Roles.AddRange(
                new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" },
                new Role { Id = 13, TenantId = 1, Name = "Staff", Slug = "staff" },
                new Role { Id = 22, TenantId = 2, Name = "Admin", Slug = "admin" });
            seed.SaveChanges();
            seed.Users.AddRange(
                User(Admin, 1, 12, "Ada", "Admin"), User(Staff, 1, 13, "Sam", "Staff"), User(OtherGymAdmin, 2, 22, "Bo", "Admin"));
            seed.SaveChanges();
        }
        _db.AddMember(Member, 1);
        _db.AddMember(OtherMember, 1);
        _db.AddMember(OtherGymMember, 2);

        using var db = _db.Create(null);
        var treadmill = new FacilityAsset { TenantId = 1, BranchId = Branch, Name = "Treadmill 3", Zone = "Cardio", AssetCode = "GB-TREAD3" };
        var pool = new FacilityAsset { TenantId = 1, BranchId = Branch, Name = "Pool", Zone = "Wellness", AssetCode = "GB-POOL", IsKeyFacility = true };
        var other = new FacilityAsset { TenantId = 2, BranchId = OtherGymBranch, Name = "Rower", AssetCode = "GB-ROW" };
        db.FacilityAssets.AddRange(treadmill, pool, other);
        db.SaveChanges();
        (_treadmill, _pool, _otherGymAsset) = (treadmill.Id, pool.Id, other.Id);
    }

    public void Dispose() => _db.Dispose();

    private static User User(ulong id, ulong tenant, ulong role, string first, string last) => new()
    {
        Id = id, TenantId = tenant, RoleId = role, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local",
        FirstName = first, LastName = last, Status = UserStatus.Active,
    };

    private static FakeUser AsMember(ulong id = Member, ulong tenant = 1) => new() { UserId = id, Role = "client", TenantId = tenant };
    private static FakeUser AsAdmin(ulong id = Admin, ulong tenant = 1) => new() { UserId = id, Role = "admin", TenantId = tenant };

    private sealed record Svc(AppDbContext Db, FacilityAssetService Assets, FacilityReportService Reports, IncidentService Incidents) : IDisposable
    {
        public void Dispose() => Db.Dispose();
    }

    private Svc Services(FakeUser me)
    {
        var db = _db.Create(me);
        var notifier = new Notifier(db, me);
        var assets = new FacilityAssetService(db, me, new ServiceStatusService(db, me), notifier);
        return new Svc(db, assets, new FacilityReportService(db, me, notifier, assets), new IncidentService(db, me));
    }

    private async Task<MyReportDetail> ReportAsync(ulong member, ulong? asset, string type = "broken", string? other = null)
    {
        using var s = Services(AsMember(member));
        return await s.Reports.CreateAsync(new CreateReportRequest
        {
            BranchId = Branch, AssetId = asset, OtherLocation = other, ProblemType = type, Description = "Belt slips",
            PhotoUrls = ["https://cdn.test/tenant-1/media/a.jpg"],
        });
    }

    private List<(ulong UserId, PushMeta Meta, string Title)> Pushes()
    {
        using var db = _db.Create(null);
        return db.CommunicationLogs.IgnoreQueryFilters().AsNoTracking().Where(l => l.Channel == CommunicationChannel.Push).ToList()
            .Select(l => (l.UserId ?? 0, PushMeta.From(l.Meta), l.Subject ?? "")).ToList();
    }

    // ── Problem reports ─────────────────────────────────────────────────────

    [Fact]
    public async Task A_second_report_for_the_same_asset_is_refused_and_a_plus_one_follows_the_first()
    {
        var first = await ReportAsync(Member, _treadmill);
        Assert.Equal("Received", first.Status);

        var ex = await Assert.ThrowsAsync<RuleException>(() => ReportAsync(OtherMember, _treadmill));
        Assert.Equal(409, ex.StatusCode);
        Assert.Equal("ALREADY_REPORTED", ex.Code);
        var existing = Assert.IsType<ExistingReportDto>(ex.Payload);
        Assert.Equal(first.Id, existing.ReportId);
        Assert.False(existing.AlreadyFollowing);

        using (var s = Services(AsMember(OtherMember)))
        {
            var check = await s.Reports.OpenForAssetAsync(_treadmill);
            Assert.Equal(first.Id, check!.ReportId);
            var plus = await s.Reports.PlusOneAsync(first.Id, new PlusOneRequest { Comment = "Also the screen is dead" });
            Assert.Equal(1, plus.PlusOneCount);
            Assert.Null(plus.Description); // a +1 doesn't see the reporter's text
            // A second +1 by the same person doesn't count twice.
            Assert.Equal(1, (await s.Reports.PlusOneAsync(first.Id, new PlusOneRequest())).PlusOneCount);
            Assert.Single(await s.Reports.GetMineAsync());
        }

        // "Something else" reports are never duplicates of each other.
        await ReportAsync(Member, null, "dirty", other: "Shower 2");
        await ReportAsync(OtherMember, null, "dirty", other: "Shower 2");

        // Fixing it tells the reporter and the +1.
        using (var s = Services(AsAdmin()))
            await s.Reports.UpdateAsync(first.Id, new UpdateReportRequest { Status = "Fixed", ResolutionNote = "New belt fitted." });
        using var db = _db.Create(null);
        var told = db.Notifications.IgnoreQueryFilters().Where(n => n.Title.StartsWith("Fixed")).Select(n => n.UserId).ToList();
        Assert.Contains(Member, told);
        Assert.Contains(OtherMember, told);

        // Closed: a new report for the asset is allowed again.
        await ReportAsync(OtherMember, _treadmill);
    }

    [Fact]
    public async Task Unsafe_reports_send_an_urgent_push_to_staff_and_suggest_out_of_service()
    {
        await ReportAsync(Member, _pool, "dirty");
        var unsafeReport = await ReportAsync(Member, _treadmill, "unsafe");

        var pushes = Pushes().Where(p => p.UserId == Admin).ToList();
        Assert.Contains(pushes, p => p.Meta.Urgent && p.Title.StartsWith("Unsafe") && p.Meta.Route == $"facility-report/{unsafeReport.Id}");
        Assert.Contains(pushes, p => !p.Meta.Urgent && p.Title.StartsWith("Problem reported")); // the dirty one
        Assert.DoesNotContain(Pushes(), p => p.UserId == OtherGymAdmin);

        using var s = Services(AsAdmin());
        var detail = await s.Reports.GetAsync(unsafeReport.Id);
        Assert.True(detail.IsUrgent);
        Assert.True(detail.SuggestOutOfService);
        Assert.Equal(2, (await s.Reports.CountsAsync()).Open);
        Assert.Equal(1, (await s.Reports.CountsAsync()).Urgent);

        // One tap from the queue: the asset goes out of service, the report moves on.
        var r = await s.Reports.MarkAssetOutOfServiceAsync(unsafeReport.Id, new ReportOutOfServiceRequest { ExpectedBackOn = new DateOnly(2030, 1, 3) });
        Assert.Equal("OutOfService", r.Asset.Asset.Status);
        Assert.Equal("InProgress", r.Report.Status);
        Assert.False(r.Report.SuggestOutOfService);
    }

    [Fact]
    public async Task A_plus_one_marked_unsafe_escalates_the_report_to_urgent()
    {
        var first = await ReportAsync(Member, _treadmill, "broken");
        using (var s = Services(AsMember(OtherMember)))
            await s.Reports.PlusOneAsync(first.Id, new PlusOneRequest { Unsafe = true });
        Assert.Contains(Pushes(), p => p.UserId == Admin && p.Meta.Urgent);
    }

    // ── Equipment status ────────────────────────────────────────────────────

    [Fact]
    public async Task Key_facility_posts_a_service_notice_only_when_confirmed_and_ends_it_when_back()
    {
        using (var s = Services(AsAdmin()))
        {
            var noNotice = await s.Assets.SetStatusAsync(_pool, new SetAssetStatusRequest { Status = "OutOfService", Reason = "Pump repair" });
            Assert.True(noNotice.OfferServiceNotice);
            Assert.Null(noNotice.ServiceStatusPostedId);
        }
        using (var db = _db.Create(null)) Assert.Empty(db.ServiceStatuses.IgnoreQueryFilters());

        // Non-key assets never post one, even if asked.
        using (var s = Services(AsAdmin()))
        {
            var t = await s.Assets.SetStatusAsync(_treadmill, new SetAssetStatusRequest { Status = "OutOfService", PostServiceNotice = true });
            Assert.False(t.OfferServiceNotice);
            Assert.Null(t.ServiceStatusPostedId);
        }

        ulong noticeId;
        using (var s = Services(AsAdmin()))
        {
            var posted = await s.Assets.SetStatusAsync(_pool, new SetAssetStatusRequest
            {
                Status = "OutOfService", Reason = "Pump repair", ExpectedBackOn = new DateOnly(2030, 1, 4), PostServiceNotice = true,
            });
            noticeId = posted.ServiceStatusPostedId!.Value;
        }
        using (var db = _db.Create(null))
        {
            var notice = db.ServiceStatuses.IgnoreQueryFilters().Single();
            Assert.Equal(noticeId, notice.Id);
            Assert.Equal("Pool", notice.Area);
            Assert.Equal(Branch, notice.BranchId);
            Assert.Null(notice.EndsAt);
        }

        // Members see the non-key machine on branch info, not the pool (that's the notice).
        using (var s = Services(AsMember()))
            Assert.Equal(["Treadmill 3"], (await s.Assets.OutOfServiceAsync(Branch)).Select(o => o.Name).ToArray());

        using (var s = Services(AsAdmin()))
        {
            var back = await s.Assets.SetStatusAsync(_pool, new SetAssetStatusRequest { Status = "InService" });
            Assert.True(back.ServiceStatusEnded);
            Assert.Null(back.Asset.ServiceStatusId);
        }
        using (var db = _db.Create(null)) Assert.NotNull(db.ServiceStatuses.IgnoreQueryFilters().Single().EndsAt);
    }

    [Fact]
    public async Task Back_in_service_can_close_open_reports_and_tells_the_reporters()
    {
        var report = await ReportAsync(Member, _treadmill);
        using (var s = Services(AsAdmin()))
        {
            await s.Assets.SetStatusAsync(_treadmill, new SetAssetStatusRequest { Status = "OutOfService" });
            var back = await s.Assets.SetStatusAsync(_treadmill, new SetAssetStatusRequest { Status = "InService", ResolveOpenReports = true });
            Assert.Equal(1, back.ReportsResolved);
        }
        using (var s = Services(AsMember()))
            Assert.Equal("Fixed", (await s.Reports.GetMineAsync(report.Id)).Status);
    }

    [Fact]
    public async Task Bulk_add_and_maintenance_history()
    {
        using var s = Services(AsAdmin());
        var added = await s.Assets.BulkCreateAsync(new BulkAssetRequest { BranchId = Branch, Zone = "Cardio", AssetType = "Bike", BaseName = "Bike", Count = 4 });
        Assert.Equal(["Bike 1", "Bike 2", "Bike 3", "Bike 4"], added.Select(a => a.Name).ToArray());
        Assert.Equal(4, added.Select(a => a.AssetCode).Distinct().Count());

        await s.Assets.AddMaintenanceAsync(_treadmill, new MaintenanceRequest
        {
            PerformedOn = new DateOnly(2026, 10, 1), Work = "Belt replaced", PerformedBy = "FitFix", Cost = 120, NextServiceDue = new DateOnly(2027, 4, 1),
        });
        var detail = await s.Assets.GetAsync(_treadmill);
        Assert.Single(detail.Maintenance);
        Assert.Equal(new DateOnly(2027, 4, 1), detail.NextServiceDue);
        Assert.Equal(new DateOnly(2026, 10, 1), detail.LastServicedOn);
    }

    // ── Incidents ───────────────────────────────────────────────────────────

    private static IncidentRequest Incident(ulong injured = Member) => new()
    {
        OccurredAt = DateTime.UtcNow.AddHours(-2), BranchId = Branch, Location = "Free weights", Type = "injury", Severity = "Medium",
        Description = "Member 100 dropped a dumbbell on their foot.", FirstAidGiven = true, FirstAidBy = "Sam", Witnesses = "Ada (front desk)",
        People =
        [
            new IncidentPersonRequest { Kind = "member", UserId = injured, IsInjuredParty = true, Contact = "+91 99999 00000" },
            new IncidentPersonRequest { Kind = "visitor", Name = "Guest Gary" },
        ],
    };

    [Fact]
    public async Task Closed_incidents_are_immutable_and_addenda_are_append_only()
    {
        ulong id;
        using (var s = Services(AsAdmin()))
        {
            var created = await s.Incidents.CreateAsync(Incident(), Meta);
            id = created.Id;
            Assert.Equal("Member 100", created.People[0].Name);
            var edited = Incident();
            edited.Severity = "High";
            Assert.Equal("High", (await s.Incidents.UpdateAsync(id, edited, Meta)).Severity);
            var closed = await s.Incidents.CloseAsync(id, new CloseIncidentRequest { ClosureNote = "Ice pack, went home." }, Meta);
            Assert.False(closed.CanEdit);

            var ex = await Assert.ThrowsAsync<RuleException>(() => s.Incidents.UpdateAsync(id, Incident(), Meta));
            Assert.Equal("INCIDENT_CLOSED", ex.Code);
            await Assert.ThrowsAsync<RuleException>(() => s.Incidents.CloseAsync(id, new CloseIncidentRequest(), Meta));

            var withAddendum = await s.Incidents.AddAddendumAsync(id, new AddendumRequest { Body = "Member called: X-ray clear." }, Meta);
            Assert.Single(withAddendum.Addenda);
        }

        // Even bypassing the service, the closed row and the addendum can't be changed.
        using (var db = _db.Create(AsAdmin()))
        {
            var row = db.Incidents.Single(i => i.Id == id);
            row.Description = "rewritten";
            Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
        }
        using (var db = _db.Create(AsAdmin()))
        {
            var add = db.IncidentAddenda.Single();
            add.Body = "changed";
            Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
        }
        using (var db = _db.Create(AsAdmin()))
        {
            db.IncidentAddenda.Remove(db.IncidentAddenda.Single());
            Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
        }
    }

    [Fact]
    public async Task Every_incident_view_and_change_is_audited_without_copying_the_text()
    {
        ulong id;
        using (var s = Services(AsAdmin()))
        {
            id = (await s.Incidents.CreateAsync(Incident(), Meta)).Id;
            await s.Incidents.GetAsync(id, Meta);
            await s.Incidents.GetAsync(id, Meta);
            var edited = Incident();
            edited.Location = "Studio 2";
            await s.Incidents.UpdateAsync(id, edited, Meta);
            await s.Incidents.ListAsync(new IncidentQuery(), Meta);
        }
        using var db = _db.Create(null);
        var logs = db.AuditLogs.IgnoreQueryFilters().Where(a => a.EntityType == "Incident").ToList();
        Assert.Equal(2, logs.Count(a => a.Action == "incident.view" && a.EntityId == id && a.UserId == Admin && a.IpAddress == "10.0.0.1"));
        Assert.Single(logs, a => a.Action == "incident.create");
        Assert.Single(logs, a => a.Action == "incident.list");
        var update = logs.Single(a => a.Action == "incident.update");
        Assert.Contains("location", update.NewValues!.RootElement.GetRawText());
        Assert.DoesNotContain("Studio 2", update.NewValues!.RootElement.GetRawText());
    }

    [Fact]
    public async Task Incident_endpoints_need_the_incidents_module()
    {
        // Every action is behind RequireModule("incidents") (class-level) and the admin role gate.
        var type = typeof(IncidentsController);
        Assert.Equal("incidents", type.GetCustomAttributesData().Single(a => a.AttributeType == typeof(RequireModuleAttribute)).ConstructorArguments[0].Value);
        Assert.NotNull(type.GetCustomAttribute<AuthorizeRolesAttribute>());

        using (var seed = _db.Create(null))
        {
            seed.Modules.Add(new GymManagmentApplication.Domain.Entities.Identity.Module { Key = "admin.incidents", Name = "Incident log", App = ModuleCatalog.AdminApp, ApiModules = "incidents" });
            seed.SaveChanges();
        }

        Assert.Equal(403, await RunFilterAsync(Staff, "staff"));   // staff role, not granted
        Assert.Equal(403, await RunFilterAsync(Member, "client")); // members never
        using (var seed = _db.Create(null))
        {
            var module = seed.Modules.Single(m => m.Key == "admin.incidents");
            seed.RoleModuleGrants.Add(new RoleModuleGrant { TenantId = 1, RoleId = 13, ModuleId = module.Id, CanView = true });
            seed.SaveChanges();
        }
        Assert.Null(await RunFilterAsync(Staff, "staff"));          // granted → passes

        // Not in the manager template; grantable (not AdminOnly).
        Assert.DoesNotContain(RoleTemplates.All.Single(t => t.Key == "manager").Grants, g => g.ModuleKey == "admin.incidents");
        Assert.False(ModuleCatalog.All.Single(m => m.Key == "admin.incidents").AdminOnly);
    }

    private async Task<int?> RunFilterAsync(ulong userId, string role)
    {
        var me = new FakeUser { UserId = userId, Role = role, TenantId = 1 };
        using var db = _db.Create(me);
        var services = new ServiceCollection()
            .AddSingleton<IAccessService>(new AccessService(db, me, new MemoryCache(new MemoryCacheOptions())))
            .BuildServiceProvider();
        var http = new DefaultHttpContext
        {
            RequestServices = services,
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role)], "test")),
        };
        http.Request.Method = "GET";
        var ctx = new AuthorizationFilterContext(new ActionContext(http, new RouteData(), new ActionDescriptor()), []);
        await new RequireModuleAttribute(FacilitiesCommon.IncidentsApi).OnAuthorizationAsync(ctx);
        return (ctx.Result as JsonResult)?.StatusCode;
    }

    // ── Isolation and privacy ───────────────────────────────────────────────

    [Fact]
    public async Task Other_gyms_never_see_assets_reports_or_incidents()
    {
        var report = await ReportAsync(Member, _treadmill);
        ulong incident;
        using (var s = Services(AsAdmin())) incident = (await s.Incidents.CreateAsync(Incident(), Meta)).Id;

        using var other = Services(AsAdmin(OtherGymAdmin, 2));
        Assert.Equal(["Rower"], (await other.Assets.ListAsync(new AssetQuery())).Select(a => a.Name).ToArray());
        await Assert.ThrowsAsync<KeyNotFoundException>(() => other.Assets.GetAsync(_treadmill));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => other.Reports.GetAsync(report.Id));
        Assert.Empty((await other.Reports.ListAsync(new ReportQuery { Status = "all" })).Items);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => other.Incidents.GetAsync(incident, Meta));
        Assert.Empty((await other.Incidents.ListAsync(new IncidentQuery(), Meta)).Items);

        // A member of gym 2 can't report on gym 1's machines.
        using var otherMember = Services(AsMember(OtherGymMember, 2));
        await Assert.ThrowsAsync<ArgumentException>(() => otherMember.Reports.CreateAsync(new CreateReportRequest { BranchId = Branch, AssetId = _treadmill, ProblemType = "broken" }));
        // Members can't read someone else's report.
        using var stranger = Services(AsMember(OtherMember));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => stranger.Reports.GetMineAsync(report.Id));
    }

    [Fact]
    public async Task Anonymisation_keeps_incidents_but_strips_the_name_and_export_has_only_a_summary()
    {
        ulong injuredIn, involvedIn;
        using (var s = Services(AsAdmin()))
        {
            injuredIn = (await s.Incidents.CreateAsync(Incident(), Meta)).Id;
            await s.Incidents.CloseAsync(injuredIn, new CloseIncidentRequest(), Meta);
            var witnessOnly = Incident(OtherMember);
            witnessOnly.People.Add(new IncidentPersonRequest { Kind = "member", UserId = Member, IsInjuredParty = false });
            involvedIn = (await s.Incidents.CreateAsync(witnessOnly, Meta)).Id;
        }

        using (var db = _db.Create(null))
        {
            var export = System.Text.Json.JsonSerializer.Serialize(await FacilitiesPrivacy.ExportIncidentSummariesAsync(db, 1, Member));
            Assert.Contains(IncidentService.Reference(injuredIn), export);
            Assert.DoesNotContain(IncidentService.Reference(involvedIn), export); // not the injured party
            Assert.DoesNotContain("dumbbell", export);                           // no description
            Assert.DoesNotContain("Gary", export);                               // no other people
            Assert.Contains("Injury", export);
        }

        using (var db = _db.Create(null))
            await FacilitiesPrivacy.AnonymiseAsync(db, 1, Member, "Member 100");

        using (var db = _db.Create(null))
        {
            var reference = FacilitiesPrivacy.AnonymisedReference(Member);
            Assert.Equal(2, db.Incidents.IgnoreQueryFilters().Count());           // kept
            var people = db.IncidentPeople.IgnoreQueryFilters().Where(p => p.UserId == Member).ToList();
            Assert.Equal(2, people.Count);
            Assert.All(people, p => { Assert.Equal(reference, p.Name); Assert.Null(p.Contact); });
            var closed = db.Incidents.IgnoreQueryFilters().Single(i => i.Id == injuredIn);
            Assert.DoesNotContain("Member 100", closed.Description);
            Assert.Contains(reference, closed.Description);
            Assert.Equal(IncidentStatus.Closed, closed.Status);
            Assert.Contains(db.IncidentPeople.IgnoreQueryFilters(), p => p.Name == "Guest Gary"); // others untouched
        }
    }
}
