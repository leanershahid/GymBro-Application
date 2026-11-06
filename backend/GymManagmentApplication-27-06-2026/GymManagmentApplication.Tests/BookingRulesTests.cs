using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Tests;

/// <summary>Cancellation & no-show rules (feature 9): cut-off, late-cancel confirmation, penalties, strikes, blocks, waivers.</summary>
public class BookingRulesTests : IDisposable
{
    private readonly TestDb _db = new();
    private const ulong Trainer = 90;
    private static readonly FakeUser Admin = new() { Role = "admin", UserId = 1, TenantId = 1 };

    public BookingRulesTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        _db.AddMember(1);
        _db.AddMember(Trainer);
        foreach (var id in new ulong[] { 100, 101, 102 }) _db.AddMember(id);
        _db.AddMember(200, tenantId: 2);
    }

    public void Dispose() => _db.Dispose();

    private static FakeUser Client(ulong id, ulong tenant = 1) => new() { Role = "client", UserId = id, TenantId = tenant };

    private async Task Rules(Action<BookingRulesSettings> edit, ulong tenant = 1)
    {
        using var db = _db.Create(null);
        var s = new BookingRulesSettings();
        edit(s);
        await BookingPenaltyEngine.SaveSettingsAsync(db, tenant, s, DateTime.UtcNow);
    }

    private ulong AddClass(DateTime startsAt, short? capacity = null, ulong tenant = 1)
    {
        using var db = _db.Create(null);
        var c = new GymClass
        {
            TenantId = tenant, BranchId = tenant * 10 + 1, ClassType = new ClassType { TenantId = tenant, Name = "Spin" }, Title = "Spin",
            StartsAt = startsAt, EndsAt = startsAt.AddHours(1), MaxCapacity = capacity,
        };
        db.GymClasses.Add(c);
        db.SaveChanges();
        return c.Id;
    }

    /// <summary>A booking inserted directly (classes in the past can't be booked through the service).</summary>
    private void AddBooking(ulong classId, ulong client, BookingStatus status = BookingStatus.Booked, ulong tenant = 1)
    {
        using var db = _db.Create(null);
        db.ClassBookings.Add(new ClassBooking { TenantId = tenant, ClassId = classId, ClientId = client, Status = status });
        db.SaveChanges();
    }

    private static ClassService Classes(AppDbContext db, FakeUser u) => new(db, u, new Notifier(db, u));

    private async Task Book(ulong classId, ulong member)
    {
        var u = Client(member);
        using var db = _db.Create(u);
        await Classes(db, u).BookAsync(classId, new BookClassRequest());
    }

    private async Task MarkNoShow(ulong classId, ulong member, bool attended = false)
    {
        using var db = _db.Create(Admin);
        await Classes(db, Admin).MarkAttendanceAsync(classId, new MarkAttendanceRequest { ClientId = member, Attended = attended });
    }

    private List<BookingPenalty> Penalties(ulong? client = null)
    {
        using var db = _db.Create(null);
        return db.BookingPenalties.AsNoTracking().Where(p => client == null || p.ClientId == client).ToList().OrderBy(p => p.Id).ToList();
    }

    private List<BookingBlock> Blocks(ulong client)
    {
        using var db = _db.Create(null);
        return db.BookingBlocks.AsNoTracking().Where(b => b.ClientId == client).ToList();
    }

    // ── Cut-off ─────────────────────────────────────────────────────────────

    [Fact]
    public void Cancelling_exactly_at_the_cut_off_is_still_free()
    {
        var start = new DateTime(2026, 11, 10, 18, 0, 0, DateTimeKind.Utc);
        Assert.Equal(start.AddHours(-2), BookingPenaltyEngine.FreeCancelUntil(start, 2));
        Assert.False(BookingPenaltyEngine.IsLate(start, 2, start.AddHours(-2)));
        Assert.True(BookingPenaltyEngine.IsLate(start, 2, start.AddHours(-2).AddSeconds(1)));
        Assert.False(BookingPenaltyEngine.IsLate(start, 2, start.AddHours(-3)));
        Assert.False(BookingPenaltyEngine.IsLate(start, 0, start.AddSeconds(-1)));
    }

    [Fact]
    public async Task Cancelling_before_the_cut_off_is_free_and_the_card_shows_until_when()
    {
        await Rules(s => { s.LateCancelConsequence = BookingRulesSettings.Fee; s.LateCancelFee = 100; });
        var start = DateTime.UtcNow.AddHours(3);
        var cls = AddClass(start);
        await Book(cls, 100);
        using (var db = _db.Create(Client(100)))
        {
            var res = await Classes(db, Client(100)).CancelBookingAsync(cls, null);
            Assert.Null(res.MyBooking);
            Assert.Equal(start.AddHours(-2), res.FreeCancelUntil);
        }
        Assert.Empty(Penalties());
    }

    // ── Late cancel ─────────────────────────────────────────────────────────

    [Fact]
    public async Task A_late_cancel_needs_confirmation_then_charges_the_fee_once_and_frees_the_spot()
    {
        await Rules(s => { s.LateCancelConsequence = BookingRulesSettings.Fee; s.LateCancelFee = 100; });
        var cls = AddClass(DateTime.UtcNow.AddHours(1), capacity: 1);
        await Book(cls, 100);
        await Book(cls, 101); // waitlisted

        using (var db = _db.Create(Client(100)))
        {
            var ex = await Assert.ThrowsAsync<RuleException>(() => Classes(db, Client(100)).CancelBookingAsync(cls, null));
            Assert.Equal(409, ex.StatusCode);
            Assert.Equal(BookingPenaltyEngine.LateCancelConfirmCode, ex.Code);
            Assert.Contains("100.00 INR", ex.Message);
        }
        using (var db = _db.Create(null))
            Assert.Equal(BookingStatus.Booked, db.ClassBookings.Single(b => b.ClientId == 100).Status); // nothing changed

        using (var db = _db.Create(Client(100)))
            await Classes(db, Client(100)).CancelBookingAsync(cls, null, confirmLate: true);

        var p = Assert.Single(Penalties());
        Assert.Equal(BookingPenaltyTypes.LateCancel, p.Type);
        Assert.Equal(100m, p.FeeAmount);
        Assert.False(p.Strike);
        using (var db = _db.Create(null))
        {
            var inv = db.Invoices.Single(i => i.UserId == 100);
            Assert.Equal(p.FeeInvoiceId, inv.Id);
            Assert.Equal(100m, inv.Total);
            Assert.Equal(InvoiceStatus.Sent, inv.Status);
            // The waitlisted member got the freed spot (auto-promote mode).
            Assert.Equal(BookingStatus.Booked, db.ClassBookings.Single(b => b.ClientId == 101).Status);
        }
    }

    [Fact]
    public async Task Without_a_consequence_a_late_cancel_needs_no_confirmation_and_staff_cancels_are_free()
    {
        var cls = AddClass(DateTime.UtcNow.AddMinutes(30));
        await Book(cls, 100);
        using (var db = _db.Create(Client(100)))
            await Classes(db, Client(100)).CancelBookingAsync(cls, null); // default: late cancel = none

        await Rules(s => { s.LateCancelConsequence = BookingRulesSettings.Fee; s.LateCancelFee = 50; });
        await Book(cls, 101);
        using (var db = _db.Create(Admin))
            await Classes(db, Admin).CancelBookingAsync(cls, 101); // staff on the member's behalf
        Assert.Empty(Penalties());
    }

    // ── No-shows ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Marking_a_no_show_twice_records_one_penalty_and_one_fee_invoice()
    {
        await Rules(s => { s.NoShowConsequence = BookingRulesSettings.Fee; s.NoShowFee = 200; });
        var cls = AddClass(DateTime.UtcNow.AddHours(5));
        await Book(cls, 100);
        await MarkNoShow(cls, 100);
        await MarkNoShow(cls, 100);

        var p = Assert.Single(Penalties());
        Assert.Equal(BookingPenaltyTypes.NoShow, p.Type);
        Assert.Equal(1UL, p.CreatedBy);
        using var db = _db.Create(null);
        Assert.Single(db.Invoices.Where(i => i.UserId == 100));
        Assert.Equal(BookingStatus.NoShow, db.ClassBookings.Single(b => b.ClientId == 100).Status);
        Assert.Equal("my-bookings", PushMeta.From(db.CommunicationLogs.First(l => l.UserId == 100 && l.Subject == "No-show fee").Meta).Route);
    }

    [Fact]
    public async Task Correcting_a_no_show_to_attended_waives_it_and_voids_the_fee()
    {
        await Rules(s => { s.NoShowConsequence = BookingRulesSettings.Fee; s.NoShowFee = 200; });
        var cls = AddClass(DateTime.UtcNow.AddHours(5));
        await Book(cls, 100);
        await MarkNoShow(cls, 100);
        await MarkNoShow(cls, 100, attended: true);
        var p = Assert.Single(Penalties());
        Assert.True(p.Waived);
        using var db = _db.Create(null);
        Assert.Equal(InvoiceStatus.Void, db.Invoices.Single(i => i.UserId == 100).Status);
    }

    [Fact]
    public async Task Strikes_in_the_window_block_self_booking_but_not_staff_booking()
    {
        await Rules(s => { s.StrikesBeforeBlock = 3; s.StrikeWindowDays = 30; s.BlockDays = 7; });
        // An old strike outside the window doesn't count.
        using (var db = _db.Create(null))
        {
            db.BookingPenalties.Add(new BookingPenalty
            {
                TenantId = 1, ClientId = 100, Type = BookingPenaltyTypes.NoShow, Strike = true, PtSessionId = 999,
                SessionStartsAt = DateTime.UtcNow.AddDays(-40), CreatedAt = DateTime.UtcNow.AddDays(-40),
            });
            db.SaveChanges();
        }
        for (var i = 0; i < 2; i++)
        {
            var c = AddClass(DateTime.UtcNow.AddHours(5 + i));
            await Book(c, 100);
            await MarkNoShow(c, 100);
        }
        Assert.Empty(Blocks(100));
        using (var db = _db.Create(Client(100)))
        {
            var standing = await new BookingRulesService(db, Client(100), new Notifier(db, Client(100))).GetMyStandingAsync();
            Assert.Equal(2, standing.Strikes);
            Assert.Equal(3, standing.StrikesBeforeBlock);
            Assert.True(standing.StrikesEnabled);
            Assert.Null(standing.ActiveBlock);
        }

        var third = AddClass(DateTime.UtcNow.AddHours(9));
        await Book(third, 100);
        await MarkNoShow(third, 100);
        var block = Assert.Single(Blocks(100));
        Assert.InRange((block.Until - block.From).TotalDays, 6.99, 7.01);

        var next = AddClass(DateTime.UtcNow.AddDays(1));
        var ex = await Assert.ThrowsAsync<RuleException>(() => Book(next, 100));
        Assert.Equal(422, ex.StatusCode);
        Assert.Equal(BookingPenaltyEngine.BookingBlockedCode, ex.Code);

        using (var db = _db.Create(Admin))
        {
            var staffBooked = await Classes(db, Admin).BookAsync(next, new BookClassRequest { ClientId = 100 });
            Assert.Equal("Booked", staffBooked.MyBooking);
        }
        using (var db = _db.Create(Client(100)))
        {
            var standing = await new BookingRulesService(db, Client(100), new Notifier(db, Client(100))).GetMyStandingAsync();
            Assert.NotNull(standing.ActiveBlock);
            Assert.Equal(0, standing.Strikes); // strikes start again after a block
        }
        using (var db = _db.Create(null))
            Assert.Contains(db.CommunicationLogs.Where(l => l.UserId == 100).Select(l => l.Subject), s => s == "Booking paused");
    }

    [Fact]
    public async Task A_blocked_member_cannot_self_book_pt()
    {
        var typeId = SeedPt();
        using (var db = _db.Create(null))
        {
            db.BookingBlocks.Add(new BookingBlock { TenantId = 1, ClientId = 100, From = DateTime.UtcNow.AddMinutes(-1), Until = DateTime.UtcNow.AddDays(2), Reason = "test" });
            db.SaveChanges();
        }
        using (var db = _db.Create(Client(100)))
        {
            var ex = await Assert.ThrowsAsync<RuleException>(() => Pt(db, Client(100)).BookAsync(new BookPtRequest { SessionTypeId = typeId, StartsAt = DateTime.UtcNow.AddDays(3) }));
            Assert.Equal(BookingPenaltyEngine.BookingBlockedCode, ex.Code);
        }
        using (var db = _db.Create(Admin))
            await Pt(db, Admin).BookAsync(new BookPtRequest { SessionTypeId = typeId, ClientId = 100, StartsAt = DateTime.UtcNow.AddDays(3) });
    }

    // ── Waive / lift ────────────────────────────────────────────────────────

    [Fact]
    public async Task Waiving_voids_an_unpaid_fee_but_not_a_paid_one_and_is_audited()
    {
        await Rules(s => { s.NoShowConsequence = BookingRulesSettings.Fee; s.NoShowFee = 150; });
        var a = AddClass(DateTime.UtcNow.AddHours(5));
        var b = AddClass(DateTime.UtcNow.AddHours(6));
        await Book(a, 100);
        await Book(b, 100);
        await MarkNoShow(a, 100);
        await MarkNoShow(b, 100);
        var (pa, pb) = (Penalties()[0], Penalties()[1]);
        using (var db = _db.Create(null))
        {
            var paid = db.Invoices.Single(i => i.Id == pb.FeeInvoiceId);
            paid.AmountPaid = paid.Total;
            paid.Status = InvoiceStatus.Paid;
            db.SaveChanges();
        }

        using (var db = _db.Create(Admin))
        {
            var svc = new BookingRulesService(db, Admin, new Notifier(db, Admin));
            await Assert.ThrowsAsync<ArgumentException>(() => svc.WaiveAsync(pa.Id, new WaivePenaltyRequest { Reason = " " }));
            Assert.True((await svc.WaiveAsync(pa.Id, new WaivePenaltyRequest { Reason = "Car broke down" })).FeeVoided);
            Assert.False((await svc.WaiveAsync(pb.Id, new WaivePenaltyRequest { Reason = "Goodwill" })).FeeVoided);
            await Assert.ThrowsAsync<RuleException>(() => svc.WaiveAsync(pa.Id, new WaivePenaltyRequest { Reason = "again" }));
        }
        using (var db = _db.Create(null))
        {
            Assert.Equal(InvoiceStatus.Void, db.Invoices.Single(i => i.Id == pa.FeeInvoiceId).Status);
            Assert.Equal(InvoiceStatus.Paid, db.Invoices.Single(i => i.Id == pb.FeeInvoiceId).Status);
            var waived = db.BookingPenalties.Single(p => p.Id == pa.Id);
            Assert.True(waived.Waived);
            Assert.Equal(1UL, waived.WaivedBy);
            Assert.Equal("Car broke down", waived.WaiveReason);
            Assert.Equal(2, db.AuditLogs.Count(l => l.Action == "booking_penalty.waive"));
        }
    }

    [Fact]
    public async Task Waiving_a_strike_lifts_the_block_it_caused_and_staff_can_lift_blocks()
    {
        await Rules(s => s.StrikesBeforeBlock = 1);
        var c = AddClass(DateTime.UtcNow.AddHours(5));
        await Book(c, 100);
        await MarkNoShow(c, 100);
        Assert.Single(Blocks(100));
        using (var db = _db.Create(Admin))
            await new BookingRulesService(db, Admin, new Notifier(db, Admin)).WaiveAsync(Penalties()[0].Id, new WaivePenaltyRequest { Reason = "Mistake" });
        Assert.NotNull(Assert.Single(Blocks(100)).LiftedAt);

        // A fresh block, lifted by hand.
        var d = AddClass(DateTime.UtcNow.AddHours(6));
        await Book(d, 100);
        await MarkNoShow(d, 100);
        var block = Blocks(100).Single(x => x.LiftedAt == null);
        using (var db = _db.Create(Admin))
        {
            var svc = new BookingRulesService(db, Admin, new Notifier(db, Admin));
            Assert.NotNull((await svc.LiftBlockAsync(block.Id, new LiftBlockRequest { Reason = "Spoke to member" })).LiftedAt);
            await Assert.ThrowsAsync<RuleException>(() => svc.LiftBlockAsync(block.Id, new LiftBlockRequest()));
        }
        await Book(AddClass(DateTime.UtcNow.AddDays(1)), 100); // can book again
    }

    [Fact]
    public async Task Delegated_staff_cannot_waive_when_the_gym_turned_it_off()
    {
        await Rules(s => s.StaffCanWaive = false);
        var c = AddClass(DateTime.UtcNow.AddHours(5));
        await Book(c, 100);
        await MarkNoShow(c, 100);
        var staff = new FakeUser { Role = "front-desk", UserId = 1, TenantId = 1 };
        using var db = _db.Create(staff);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            new BookingRulesService(db, staff, new Notifier(db, staff)).WaiveAsync(Penalties()[0].Id, new WaivePenaltyRequest { Reason = "x" }));
    }

    // ── PT ──────────────────────────────────────────────────────────────────

    private ulong SeedPt()
    {
        using var db = _db.Create(null);
        var trainer = new TrainerProfile { TenantId = 1, UserId = Trainer, BranchId = 11, DisplayName = "Tara" };
        db.TrainerProfiles.Add(trainer);
        db.SaveChanges();
        var type = new PtSessionType { TenantId = 1, TrainerId = trainer.Id, Name = "1:1", DurationMin = 60, Price = 0, Currency = "INR" };
        db.PtSessionTypes.Add(type);
        db.SaveChanges();
        return type.Id;
    }

    private ulong AddSession(ulong typeId, DateTime startsAt)
    {
        using var db = _db.Create(null);
        var type = db.PtSessionTypes.Single(t => t.Id == typeId);
        var s = new PtSession
        {
            TenantId = 1, SessionTypeId = typeId, TrainerId = type.TrainerId, ClientId = 100,
            StartsAt = startsAt, EndsAt = startsAt.AddHours(1), Status = PtSessionStatus.Confirmed,
        };
        db.PtSessions.Add(s);
        db.SaveChanges();
        return s.Id;
    }

    private static PtService Pt(AppDbContext db, FakeUser u)
    {
        var n = new Notifier(db, u);
        return new PtService(db, u, new BillingCore(db, n), n);
    }

    [Fact]
    public async Task Pt_member_late_cancel_needs_confirmation_but_a_trainer_cancel_never_penalises()
    {
        await Rules(s => { s.LateCancelConsequence = BookingRulesSettings.Fee; s.LateCancelFee = 300; s.PtCancelCutoffHours = 24; });
        var typeId = SeedPt();
        var late = AddSession(typeId, DateTime.UtcNow.AddHours(10));
        var early = AddSession(typeId, DateTime.UtcNow.AddHours(30));
        var byTrainer = AddSession(typeId, DateTime.UtcNow.AddHours(5));

        using (var db = _db.Create(Client(100)))
        {
            var svc = Pt(db, Client(100));
            var ex = await Assert.ThrowsAsync<RuleException>(() => svc.UpdateStatusAsync(late, new UpdatePtStatusRequest { Status = "cancelled" }));
            Assert.Equal(BookingPenaltyEngine.LateCancelConfirmCode, ex.Code);
            await svc.UpdateStatusAsync(late, new UpdatePtStatusRequest { Status = "cancelled", ConfirmLate = true });
            await svc.UpdateStatusAsync(early, new UpdatePtStatusRequest { Status = "cancelled" }); // before the cut-off: free
        }
        var trainer = new FakeUser { Role = "trainer", UserId = Trainer, TenantId = 1 };
        using (var db = _db.Create(trainer))
            await Pt(db, trainer).UpdateStatusAsync(byTrainer, new UpdatePtStatusRequest { Status = "cancelled" });

        var p = Assert.Single(Penalties());
        Assert.Equal(late, p.PtSessionId);
        Assert.Equal(300m, p.FeeAmount);
    }

    [Fact]
    public async Task Pt_no_show_is_recorded_once()
    {
        var typeId = SeedPt();
        var s = AddSession(typeId, DateTime.UtcNow.AddHours(-2));
        var trainer = new FakeUser { Role = "trainer", UserId = Trainer, TenantId = 1 };
        using (var db = _db.Create(trainer))
        {
            await Pt(db, trainer).UpdateStatusAsync(s, new UpdatePtStatusRequest { Status = "noshow" });
        }
        using (var db = _db.Create(trainer))
            await Pt(db, trainer).UpdateStatusAsync(s, new UpdatePtStatusRequest { Status = "noshow" });
        var p = Assert.Single(Penalties());
        Assert.True(p.Strike); // default consequence
        Assert.Equal(BookingPenaltyTypes.NoShow, p.Type);
    }

    // ── Automatic no-show ───────────────────────────────────────────────────

    [Fact]
    public async Task Auto_no_show_only_runs_when_enabled_and_only_where_attendance_was_never_taken()
    {
        var ended = AddClass(DateTime.UtcNow.AddHours(-3)); // ended 2 h ago
        AddBooking(ended, 100);
        var taken = AddClass(DateTime.UtcNow.AddHours(-4));
        AddBooking(taken, 101, BookingStatus.Attended);
        AddBooking(taken, 102);

        async Task<int> Run()
        {
            using var db = _db.Create(null);
            return await new BookingPenaltyEngine(db, new Notifier(db, new FakeUser { IsAuthenticated = false, UserId = null }))
                .RunAutoNoShowAsync(1, DateTime.UtcNow);
        }

        Assert.Equal(0, await Run()); // off by default
        // Switched on now: classes that ended before that aren't swept retroactively.
        await Rules(s => { s.AutoNoShowEnabled = true; s.AutoNoShowAfterMinutes = 30; });
        Assert.Equal(0, await Run());

        // Pretend it was switched on yesterday.
        using (var db = _db.Create(null))
        {
            var row = db.TenantSettings.Single(x => x.TenantId == 1 && x.Key == BookingPenaltyEngine.SettingKey);
            var s = (await BookingPenaltyEngine.LoadSettingsAsync(db, 1));
            s.AutoNoShowSince = DateTime.UtcNow.AddDays(-1);
            row.Value = System.Text.Json.JsonSerializer.SerializeToDocument(s, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
            db.SaveChanges();
        }
        Assert.Equal(1, await Run());
        Assert.Equal(0, await Run()); // idempotent

        using (var db = _db.Create(null))
        {
            Assert.Equal(BookingStatus.NoShow, db.ClassBookings.Single(b => b.ClassId == ended).Status);
            Assert.Equal(BookingStatus.Booked, db.ClassBookings.Single(b => b.ClassId == taken && b.ClientId == 102).Status);
        }
        var p = Assert.Single(Penalties());
        Assert.Equal(100UL, p.ClientId);
        Assert.Null(p.CreatedBy);
    }

    // ── Settings & isolation ────────────────────────────────────────────────

    [Fact]
    public async Task Settings_have_defaults_and_reject_lose_credit()
    {
        using var db = _db.Create(Admin);
        var svc = new BookingRulesService(db, Admin, new Notifier(db, Admin));
        var s = await svc.GetSettingsAsync();
        Assert.Equal(2, s.ClassCancelCutoffHours);
        Assert.Equal(24, s.PtCancelCutoffHours);
        Assert.Equal("none", s.LateCancelConsequence);
        Assert.Equal("strike", s.NoShowConsequence);
        Assert.Equal(3, s.StrikesBeforeBlock);
        Assert.Equal(30, s.StrikeWindowDays);
        Assert.Equal(7, s.BlockDays);
        Assert.True(s.StaffCanWaive);
        Assert.False(s.AutoNoShowEnabled);
        Assert.False(s.CreditsSupported);
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveSettingsAsync(new BookingRulesSettings { NoShowConsequence = "lose_credit" }));
        await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveSettingsAsync(new BookingRulesSettings { LateCancelConsequence = "fee", LateCancelFee = 0 }));
        var saved = await svc.SaveSettingsAsync(new BookingRulesSettings { ClassCancelCutoffHours = 4, AutoNoShowEnabled = true });
        Assert.Equal(4, saved.ClassCancelCutoffHours);
        Assert.NotNull(saved.AutoNoShowSince);
        Assert.Single(db.AuditLogs.Where(l => l.Action == "booking_rules.update"));
    }

    [Fact]
    public async Task Penalties_blocks_and_settings_stay_inside_their_gym()
    {
        await Rules(s => s.StrikesBeforeBlock = 1);
        var c = AddClass(DateTime.UtcNow.AddHours(5));
        await Book(c, 100);
        await MarkNoShow(c, 100);
        var penalty = Penalties()[0];
        var block = Blocks(100)[0];

        var other = new FakeUser { Role = "admin", UserId = 200, TenantId = 2 };
        using (var db = _db.Create(other))
        {
            var svc = new BookingRulesService(db, other, new Notifier(db, other));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.WaiveAsync(penalty.Id, new WaivePenaltyRequest { Reason = "x" }));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.LiftBlockAsync(block.Id, new LiftBlockRequest()));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.GetMemberStandingAsync(100));
            Assert.Empty(await svc.GetPenaltiesAsync(c, null, null));
            Assert.Equal(3, (await svc.GetSettingsAsync()).StrikesBeforeBlock); // gym 2 still has defaults
        }
        // Gym 2's member isn't blocked by gym 1's block.
        var c2 = AddClass(DateTime.UtcNow.AddHours(5), tenant: 2);
        using (var db = _db.Create(Client(200, 2)))
            await Classes(db, Client(200, 2)).BookAsync(c2, new BookClassRequest());
    }
}
