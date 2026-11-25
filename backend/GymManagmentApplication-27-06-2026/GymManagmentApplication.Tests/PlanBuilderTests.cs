using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Privacy;
using GymManagmentApplication.Application.Training;
using GymManagmentApplication.Application.Workout;
using GymManagmentApplication.Application.Workout.Requests;
using GymManagmentApplication.Application.Workout.Services;
using GymManagmentApplication.Application.WorkoutPlan.Requests;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using GymManagmentApplication.Infrastructure.Repositories.Workout;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Plan = GymManagmentApplication.Domain.Entities.Training.WorkoutPlan;

namespace GymManagmentApplication.Tests;

/// <summary>Weekly plan builder: day workouts, copies, assign, overrides, set logs and records.</summary>
public class PlanBuilderTests : IDisposable
{
    private const ulong Admin = 1, Trainer = 2, OtherTrainer = 3, Member = 100, Member2 = 101, NotMyClient = 102, OtherGymMember = 200;
    private const ulong Bench = 500, Squat = 501, PushUp = 502;
    private const ulong PublicWorkout = 600, PrivateWorkout = 601;
    /// <summary>A Monday.</summary>
    private static readonly DateOnly Today = new(2026, 11, 2);
    private readonly TestDb _db = new();

    public PlanBuilderTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        foreach (var id in new[] { Admin, Trainer, OtherTrainer, Member, Member2, NotMyClient }) _db.AddMember(id, 1);
        _db.AddMember(OtherGymMember, 2);
        using var db = _db.Create(null);
        var tp = new TrainerProfile { Id = 1, TenantId = 1, UserId = Trainer, BranchId = 11, DisplayName = "Coach Tom" };
        var tp2 = new TrainerProfile { Id = 2, TenantId = 1, UserId = OtherTrainer, BranchId = 11, DisplayName = "Coach Tia" };
        db.TrainerProfiles.AddRange(tp, tp2);
        db.TrainerClientAssignments.Add(new TrainerClientAssignment { TenantId = 1, TrainerId = 1, ClientId = Member, BranchId = 11 });
        db.TrainerClientAssignments.Add(new TrainerClientAssignment { TenantId = 1, TrainerId = 1, ClientId = Member2, BranchId = 11 });
        db.Exercises.AddRange(
            new Exercise { Id = Bench, TenantId = 1, Name = "Bench press", Slug = "bench" },
            new Exercise { Id = Squat, TenantId = 1, Name = "Squat", Slug = "squat" },
            new Exercise { Id = PushUp, TenantId = 1, Name = "Push-up", Slug = "push-up" });
        db.WorkoutTemplates.Add(new WorkoutTemplate { Id = PublicWorkout, TenantId = 1, CreatedBy = Admin, Name = "Chest day", IsPublic = true });
        db.WorkoutTemplates.Add(new WorkoutTemplate { Id = PrivateWorkout, TenantId = 1, CreatedBy = Admin, Name = "Secret day" });
        var section = new WorkoutSection { TemplateId = PublicWorkout, Name = "Main", SortOrder = 0 };
        db.WorkoutSections.Add(section);
        db.SaveChanges();
        db.WorkoutExercises.Add(new WorkoutExercise { SectionId = section.Id, ExerciseId = Bench, Sets = 3, Reps = "8" });
        db.SaveChanges();
    }

    public void Dispose() => _db.Dispose();

    private static FakeUser AsAdmin() => new() { UserId = Admin, Role = "admin", TenantId = 1 };
    private static FakeUser AsTrainer(ulong id = Trainer) => new() { UserId = id, Role = "trainer", TenantId = 1 };
    private static FakeUser AsMember(ulong id = Member, ulong tenant = 1) => new() { UserId = id, Role = "client", TenantId = tenant };

    private (AppDbContext Db, PlanBuilderService Svc) Builder(FakeUser u)
    {
        var db = _db.Create(u);
        return (db, new PlanBuilderService(db, u, new Notifier(db, u)) { TodayOverride = Today });
    }

    private (AppDbContext Db, MemberTrainingService Svc) Training(FakeUser u)
    {
        var db = _db.Create(u);
        return (db, new MemberTrainingService(db, u) { TodayOverride = Today });
    }

    private (AppDbContext Db, WorkoutService Svc) Workouts(FakeUser u)
    {
        var db = _db.Create(u);
        return (db, new WorkoutService(new WorkoutRepository(db), u, db, new Notifier(db, u)) { TodayOverride = Today });
    }

    private ulong NewPlan(ulong createdBy = Admin, byte weeks = 2, ulong tenant = 1)
    {
        using var db = _db.Create(null);
        var p = new Plan { TenantId = tenant, CreatedBy = createdBy, Name = "Strength", DurationWeeks = weeks };
        db.WorkoutPlans.Add(p);
        db.SaveChanges();
        return p.Id;
    }

    private async Task<BuilderDayDto> DayAsync(ulong plan, byte w, byte d, string? title, bool rest = false, FakeUser? u = null)
    {
        var (db, svc) = Builder(u ?? AsAdmin());
        using (db) return await svc.UpsertDayAsync(plan, w, d, new UpsertPlanDayRequest { Title = title, IsRestDay = rest });
    }

    private async Task<BuilderDayDto> FromLibraryAsync(ulong plan, ulong dayId, ulong workout = PublicWorkout)
    {
        var (db, svc) = Builder(AsAdmin());
        using (db) return await svc.FromLibraryAsync(plan, dayId, new FromLibraryRequest { WorkoutId = workout });
    }

    private async Task<List<PlanMemberDto>> AssignAsync(ulong plan, ulong member = Member, byte week = 1, byte day = 1, bool replace = false, FakeUser? u = null)
    {
        var (db, svc) = Builder(u ?? AsAdmin());
        using (db) return await svc.AssignAsync(plan, new AssignPlanRequest
        {
            MemberIds = [member], StartDate = Today, StartWeek = week, StartDay = day, ReplaceExisting = replace,
        });
    }

    private async Task<WorkoutStructureDto> StructureAsync(ulong workout, FakeUser? u = null)
    {
        using var db = _db.Create(u ?? AsAdmin());
        return await new WorkoutStructureService(db, u ?? AsAdmin()).GetStructureAsync(workout);
    }

    private async Task SaveStructureAsync(ulong workout, params ulong[] exercises)
    {
        using var db = _db.Create(AsAdmin());
        await new WorkoutStructureService(db, AsAdmin()).SaveStructureAsync(workout, new WorkoutStructureDto
        {
            Sections = [new SectionDto { Name = "Main", Exercises = exercises.Select(e => new SectionExerciseDto { ExerciseId = e, Sets = 3, Reps = "10" }).ToList() }],
        });
    }

    private async Task<PlanBuilderDto> BuilderAsync(ulong plan)
    {
        var (db, svc) = Builder(AsAdmin());
        using (db) return await svc.GetBuilderAsync(plan);
    }

    private static CompleteWorkoutRequest Session(params CompleteSetRequest[] sets) => new()
    {
        StartedAt = DateTime.UtcNow.AddMinutes(-45), EndedAt = DateTime.UtcNow, Sets = sets.ToList(),
    };

    private static CompleteSetRequest Set(ulong exercise, byte no, ushort reps, decimal? kg, string? type = null) =>
        new() { ExerciseId = exercise, SetNo = no, Reps = reps, WeightKg = kg, SetType = type };

    // ── Day workouts and copies ────────────────────────────────────────────

    [Fact]
    public async Task Day_gets_its_own_workout_and_library_copies_are_independent()
    {
        var plan = NewPlan();
        var day = await DayAsync(plan, 1, 1, "Push");
        Assert.NotNull(day.WorkoutId);
        Assert.True(day.OwnsWorkout);
        day = await FromLibraryAsync(plan, day.DayId!.Value);
        Assert.NotEqual(PublicWorkout, day.WorkoutId);
        Assert.Equal(1, day.ExerciseCount);
        Assert.Equal("Push", day.Title);

        // Editing the day never changes the library workout.
        await SaveStructureAsync(day.WorkoutId!.Value, Bench, Squat);
        Assert.Single((await StructureAsync(PublicWorkout)).Sections.Single().Exercises);

        // Day workouts are not in the library.
        var (db, workouts) = Workouts(AsAdmin());
        using (db)
            Assert.DoesNotContain((await workouts.GetAllAsync(new WorkoutListRequest { PageSize = 100 })).Items, w => w.Id == day.WorkoutId);
    }

    [Fact]
    public async Task Assigned_copy_is_independent_of_the_master()
    {
        var plan = NewPlan();
        var day = await DayAsync(plan, 1, 1, "Push");
        await SaveStructureAsync(day.WorkoutId!.Value, Bench);
        var member = (await AssignAsync(plan)).Single();
        Assert.NotEqual(plan, member.PlanId);

        var copy = await BuilderAsync(member.PlanId);
        Assert.False(copy.IsTemplate);
        Assert.Equal(Member, copy.OwnerClientId);
        Assert.Equal(plan, copy.SourcePlanId);
        var copyDay = copy.Weeks[0].Days[0];
        Assert.NotEqual(day.WorkoutId, copyDay.WorkoutId);
        Assert.True(copyDay.OwnsWorkout);

        // Edit the master: the copy keeps its content; edit the copy: the master keeps its content.
        await SaveStructureAsync(day.WorkoutId.Value, Bench, Squat, PushUp);
        Assert.Single((await StructureAsync(copyDay.WorkoutId!.Value)).Sections.Single().Exercises);
        await SaveStructureAsync(copyDay.WorkoutId.Value, Squat);
        Assert.Equal(3, (await StructureAsync(day.WorkoutId.Value)).Sections.Single().Exercises.Count);
    }

    [Fact]
    public async Task Old_day_pointing_at_a_library_workout_is_copied_on_write()
    {
        var plan = NewPlan();
        using (var db = _db.Create(null))
        {
            var week = new WorkoutPlanWeek { PlanId = plan, WeekNumber = 1 };
            db.WorkoutPlanWeeks.Add(week);
            db.SaveChanges();
            db.WorkoutPlanDays.Add(new WorkoutPlanDay { WeekId = week.Id, DayNumber = 1, TemplateId = PublicWorkout });
            db.SaveChanges();
        }
        Assert.False((await BuilderAsync(plan)).Weeks[0].Days[0].OwnsWorkout);
        var day = await DayAsync(plan, 1, 1, "Push");
        Assert.True(day.OwnsWorkout);
        Assert.NotEqual(PublicWorkout, day.WorkoutId);
        Assert.Equal(1, day.ExerciseCount);
        Assert.Equal("Chest day", (await StructureAsync(PublicWorkout)).WorkoutName);
    }

    [Fact]
    public async Task Copy_day_and_copy_week_make_independent_copies()
    {
        var plan = NewPlan(weeks: 2);
        var push = await DayAsync(plan, 1, 1, "Push");
        await SaveStructureAsync(push.WorkoutId!.Value, Bench, Squat);
        await DayAsync(plan, 1, 2, null, rest: true);

        var (db, svc) = Builder(AsAdmin());
        PlanBuilderDto result;
        using (db) result = await svc.CopyDayAsync(plan, push.DayId!.Value, new CopyDayRequest { Targets = [new() { Week = 1, Day = 3 }, new() { Week = 2, Day = 1 }] });
        var w1d3 = result.Weeks[0].Days[2];
        var w2d1 = result.Weeks[1].Days[0];
        Assert.Equal("Push", w1d3.Title);
        Assert.Equal(2, w2d1.ExerciseCount);
        Assert.Equal(3, new[] { push.WorkoutId, w1d3.WorkoutId, w2d1.WorkoutId }.Distinct().Count());

        (db, svc) = Builder(AsAdmin());
        using (db) result = await svc.CopyWeekAsync(plan, 1, new CopyWeekRequest { ToWeeks = [2, 3] });
        Assert.Equal(3, result.DurationWeeks);
        Assert.True(result.Weeks[2].Days[1].IsRestDay);
        Assert.Equal("Push", result.Weeks[2].Days[0].Title);
        Assert.Equal(2, result.Weeks[2].Days[0].ExerciseCount);
        Assert.Null(result.Weeks[1].Days[3].DayId); // week 2 now mirrors week 1 (day 4 empty)
        var ids = result.Weeks.SelectMany(w => w.Days).Where(d => d.WorkoutId != null).Select(d => d.WorkoutId).ToList();
        Assert.Equal(ids.Count, ids.Distinct().Count());

        // Editing week 3's copy leaves week 1 alone.
        await SaveStructureAsync(result.Weeks[2].Days[0].WorkoutId!.Value, PushUp);
        Assert.Equal(2, (await StructureAsync(push.WorkoutId.Value)).Sections.Single().Exercises.Count);
    }

    [Fact]
    public async Task Rest_days_and_week_delete_renumbers_and_purges_unused_day_workouts()
    {
        var plan = NewPlan(weeks: 3);
        await DayAsync(plan, 1, 1, "A");
        var rest = await DayAsync(plan, 1, 2, null, rest: true);
        Assert.True(rest.IsRestDay);
        Assert.Null(rest.WorkoutId);
        var b = await DayAsync(plan, 2, 1, "B");
        await DayAsync(plan, 3, 1, "C");

        var (db, svc) = Builder(AsAdmin());
        PlanBuilderDto result;
        using (db) result = await svc.DeleteWeekAsync(plan, 2);
        Assert.Equal(2, result.DurationWeeks);
        Assert.Equal("A", result.Weeks[0].Days[0].Title);
        Assert.Equal("C", result.Weeks[1].Days[0].Title);
        using (var check = _db.Create(null))
            Assert.False(check.WorkoutTemplates.Any(w => w.Id == b.WorkoutId));

        (db, svc) = Builder(AsAdmin());
        using (db) await Assert.ThrowsAsync<ArgumentException>(() => svc.DeleteWeekAsync(plan, 5));

        (db, svc) = Builder(AsAdmin());
        using (db) result = await svc.AddWeekAsync(plan, new AddWeekRequest { CopyFrom = 1 });
        Assert.Equal(3, result.DurationWeeks);
        Assert.Equal("A", result.Weeks[2].Days[0].Title);
        Assert.True(result.Weeks[2].Days[1].IsRestDay);
    }

    [Fact]
    public async Task Clear_day_and_duplicate_plan()
    {
        var plan = NewPlan();
        var day = await DayAsync(plan, 1, 1, "Push");
        var (db, svc) = Builder(AsAdmin());
        PlanBuilderDto dup;
        using (db) dup = await svc.DuplicatePlanForTest(plan);
        Assert.True(dup.IsTemplate);
        Assert.Equal(plan, dup.SourcePlanId);
        Assert.NotEqual(day.WorkoutId, dup.Weeks[0].Days[0].WorkoutId);

        (db, svc) = Builder(AsAdmin());
        BuilderDayDto cleared;
        using (db) cleared = await svc.ClearDayAsync(plan, day.DayId!.Value);
        Assert.Null(cleared.WorkoutId);
        Assert.Null(cleared.Title);
        Assert.Equal("Push", (await BuilderAsync(dup.PlanId)).Weeks[0].Days[0].Title);
    }

    // ── Assign, today, overrides ───────────────────────────────────────────

    [Fact]
    public async Task Assign_with_start_offset_resolves_today()
    {
        var plan = NewPlan(weeks: 2);
        await DayAsync(plan, 1, 1, "Push");
        await DayAsync(plan, 2, 3, "Legs");
        var a = (await AssignAsync(plan, week: 2, day: 3)).Single();
        Assert.Equal(Today.AddDays(-9), a.StartDate);

        var (db, svc) = Training(AsMember());
        using (db)
        {
            var me = await svc.GetMyTrainingAsync();
            Assert.Equal(a.AssignmentId, me.ActivePlanAssignmentId);
            var p = me.Plans.Single();
            Assert.Equal((byte)2, p.CurrentWeek);
            Assert.Equal((byte)3, p.CurrentDay);
            Assert.Equal("Legs", p.TodayTitle);
            Assert.False(p.TodayIsRest);
            Assert.NotNull(p.TodayWorkoutId);
            Assert.Equal(7, p.WeekStrip.Count);
            Assert.True(p.WeekStrip.Single(s => s.IsToday).Date == Today);
            Assert.NotNull(p.Adherence);
        }

        // Notified (kind "training").
        using var check = _db.Create(null);
        Assert.True(check.Notifications.Any(n => n.UserId == Member));
    }

    [Fact]
    public async Task One_active_plan_per_member_unless_replaced()
    {
        var plan = NewPlan();
        await DayAsync(plan, 1, 1, "Push");
        var first = (await AssignAsync(plan)).Single();
        var ex = await Assert.ThrowsAsync<RuleException>(() => AssignAsync(plan));
        Assert.Equal("PLAN_ALREADY_ACTIVE", ex.Code);
        Assert.Equal(409, ex.StatusCode);

        var second = (await AssignAsync(plan, replace: true)).Single();
        using var db = _db.Create(null);
        Assert.Equal(AssignmentStatus.Expired, db.WorkoutPlanAssignments.Single(x => x.Id == first.AssignmentId).Status);
        Assert.Equal(AssignmentStatus.Assigned, db.WorkoutPlanAssignments.Single(x => x.Id == second.AssignmentId).Status);
    }

    [Fact]
    public async Task Member_can_skip_and_move_days()
    {
        var plan = NewPlan();
        await DayAsync(plan, 1, 1, "Push");
        await DayAsync(plan, 1, 2, "Pull");
        var a = (await AssignAsync(plan)).Single();

        var (db, svc) = Training(AsMember());
        using (db)
        {
            await svc.SkipAsync(a.AssignmentId, new DayOverrideRequest { Date = Today });
            await svc.MoveAsync(a.AssignmentId, new DayOverrideRequest { Date = Today.AddDays(1), ToDate = Today.AddDays(2) });
            await Assert.ThrowsAsync<ArgumentException>(() => svc.SkipAsync(a.AssignmentId, new DayOverrideRequest { Date = Today.AddDays(3) })); // empty (rest) day
            await Assert.ThrowsAsync<ArgumentException>(() => svc.MoveAsync(a.AssignmentId, new DayOverrideRequest { Date = Today, ToDate = Today.AddDays(-1) }));

            var me = (await svc.GetMyTrainingAsync()).Plans.Single();
            Assert.True(me.TodaySkipped);
            Assert.True(me.TodayIsRest);
            Assert.Null(me.TodayWorkoutId);
            var tue = me.WeekStrip[1];
            Assert.True(tue.Moved);
            var wed = me.WeekStrip[2];
            Assert.Equal("Pull", wed.Title);
            Assert.Equal(Today.AddDays(1), wed.MovedFromDate);

            var cal = await svc.GetCalendarAsync(a.AssignmentId, Today, Today.AddDays(6));
            Assert.Equal(CalendarStatuses.Skipped, cal.Entries.First(e => e.Date == Today).Status);
            Assert.Contains(cal.Entries, e => e.Date == Today.AddDays(2) && e.MovedFromDate == Today.AddDays(1));

            Assert.True(await svc.ClearOverrideAsync(a.AssignmentId, Today));
            Assert.Equal("Push", (await svc.GetMyTrainingAsync()).Plans.Single().TodayTitle);
        }

        // Another member can't see it.
        (db, svc) = Training(AsMember(Member2));
        using (db) await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.GetCalendarAsync(a.AssignmentId, null, null));

        // Staff can skip on the member's behalf.
        (db, svc) = Training(AsTrainer());
        using (db) Assert.Equal("skip", (await svc.SkipAsync(a.AssignmentId, new DayOverrideRequest { Date = Today })).Action);
    }

    // ── Complete: set logs, records, links ──────────────────────────────────

    [Fact]
    public async Task Complete_persists_sets_and_detects_records()
    {
        var (db, svc) = Workouts(AsMember());
        Application.Workout.Responses.CompleteWorkoutResponse first;
        using (db) first = await svc.CompleteAsync(PublicWorkout, Session(
            Set(Bench, 1, 10, 40, "warmup"), Set(Bench, 2, 8, 60), Set(Bench, 3, 5, 70), Set(PushUp, 1, 20, null)));
        Assert.Equal(4, first.Summary.Sets);
        Assert.Equal(2, first.Summary.Exercises);
        Assert.Equal(400 + 480 + 350, first.Summary.VolumeKg);
        Assert.Empty(first.NewRecords); // first values are stored quietly
        Assert.Equal(first.Id, first.LogId);

        using (var check = _db.Create(null))
        {
            Assert.Equal(4, check.WorkoutSetLogs.Count(s => s.WorkoutLogId == first.LogId));
            Assert.Equal(70m, check.PersonalRecords.Single(r => r.ExerciseId == Bench && r.Type == PersonalRecordType.HeaviestWeight).Value);
            Assert.Equal(20m, check.PersonalRecords.Single(r => r.ExerciseId == PushUp && r.Type == PersonalRecordType.MostReps).Value);
            Assert.Equal(480m, check.PersonalRecords.Single(r => r.ExerciseId == Bench && r.Type == PersonalRecordType.BestSetVolume).Value);
        }

        (db, svc) = Workouts(AsMember());
        Application.Workout.Responses.CompleteWorkoutResponse second;
        using (db) second = await svc.CompleteAsync(PublicWorkout, Session(Set(Bench, 1, 3, 75), Set(Bench, 2, 30, 20, "warmup"), Set(PushUp, 1, 20, null)));
        var heaviest = second.NewRecords.Single(r => r.Type == "heaviestWeight");
        Assert.Equal(75m, heaviest.Value);
        Assert.Equal(70m, heaviest.PreviousValue);
        Assert.Equal(82.5m, second.NewRecords.Single(r => r.Type == "estimatedOneRepMax").Value); // 75 × (1 + 3/30)
        Assert.DoesNotContain(second.NewRecords, r => r.Type == "bestSetVolume"); // 225 < 480; the warm-up doesn't count
        Assert.DoesNotContain(second.NewRecords, r => r.Type == "mostReps");      // equal is not a record

        // Previous performance, records, history.
        var (tdb, training) = Training(AsMember());
        using (tdb)
        {
            var last = await training.GetLastAsync(Bench);
            Assert.Equal(second.LogId, last!.LogId);
            Assert.Equal(75m, last.BestSet!.WeightKg);
            Assert.Null(await training.GetLastAsync(Squat));
            Assert.Contains(await training.GetRecordsAsync(null), r => r.Type == "heaviestWeight" && r.Value == 75m);
            var history = await training.GetHistoryAsync(1, 10);
            Assert.Equal(2, history.TotalRecords);
            Assert.Equal(second.LogId, history.Items.First().LogId);
            Assert.Equal(3, (await training.GetHistoryItemAsync(second.LogId)).SetLogs.Count);
        }
    }

    [Fact]
    public async Task Members_only_complete_for_themselves()
    {
        var (db, svc) = Workouts(AsMember());
        using (db)
        {
            var request = Session(Set(Bench, 1, 5, 50));
            request.ClientId = Member2;
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => svc.CompleteAsync(PublicWorkout, request));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.CompleteAsync(PrivateWorkout, Session()));
        }
        // A trainer logs for their client.
        (db, svc) = Workouts(AsTrainer());
        using (db)
        {
            var request = Session(Set(Bench, 1, 5, 50));
            request.ClientId = Member;
            Assert.Equal(Member, (await svc.CompleteAsync(PublicWorkout, request)).ClientId);
        }
    }

    [Fact]
    public async Task Complete_links_the_plan_day_and_direct_assignment()
    {
        var plan = NewPlan();
        var push = await DayAsync(plan, 1, 1, "Push");
        await SaveStructureAsync(push.WorkoutId!.Value, Bench);
        var a = (await AssignAsync(plan)).Single();
        var copyWorkout = (await BuilderAsync(a.PlanId)).Weeks[0].Days[0].WorkoutId!.Value;

        // Plan day inferred from the workout.
        var (db, svc) = Workouts(AsMember());
        Application.Workout.Responses.CompleteWorkoutResponse res;
        using (db) res = await svc.CompleteAsync(copyWorkout, Session(Set(Bench, 1, 5, 50)));
        Assert.Equal(a.AssignmentId, res.PlanAssignmentId);
        Assert.Equal((byte)1, res.WeekNumber);
        Assert.Equal((byte)1, res.DayNumber);

        var (tdb, training) = Training(AsMember());
        using (tdb)
        {
            var p = (await training.GetMyTrainingAsync()).Plans.Single();
            Assert.True(p.TodayDone);
            Assert.True(p.WeekStrip[0].Done);
            Assert.Equal("Completed", p.Status); // its only training day is done
        }

        // Explicit plan day must match the workout.
        (db, svc) = Workouts(AsMember());
        using (db)
        {
            var wrong = Session();
            wrong.PlanAssignmentId = a.AssignmentId; wrong.Week = 1; wrong.Day = 2;
            await Assert.ThrowsAsync<ArgumentException>(() => svc.CompleteAsync(copyWorkout, wrong));
        }

        // Direct assignment becomes Completed.
        ulong assignmentId;
        using (var seed = _db.Create(null))
        {
            var wa = new WorkoutAssignment { TenantId = 1, ClientId = Member, TemplateId = PrivateWorkout, AssignedAt = Today };
            seed.WorkoutAssignments.Add(wa);
            seed.SaveChanges();
            assignmentId = wa.Id;
        }
        (db, svc) = Workouts(AsMember());
        using (db) Assert.Equal(assignmentId, (await svc.CompleteAsync(PrivateWorkout, Session())).AssignmentId);
        using var check = _db.Create(null);
        Assert.Equal(AssignmentStatus.Completed, check.WorkoutAssignments.Single(x => x.Id == assignmentId).Status);
    }

    // ── Library, delete, access ─────────────────────────────────────────────

    [Fact]
    public async Task Members_see_public_and_assigned_workouts_only()
    {
        var (db, svc) = Workouts(AsMember());
        using (db)
        {
            var ids = (await svc.GetAllAsync(new WorkoutListRequest { PageSize = 100 })).Items.Select(w => w.Id).ToList();
            Assert.Contains(PublicWorkout, ids);
            Assert.DoesNotContain(PrivateWorkout, ids);
            Assert.Null(await svc.GetByIdAsync(PrivateWorkout));
        }
        await Assert.ThrowsAsync<KeyNotFoundException>(() => StructureAsync(PrivateWorkout, AsMember()));

        using (var seed = _db.Create(null))
        {
            seed.WorkoutAssignments.Add(new WorkoutAssignment { TenantId = 1, ClientId = Member, TemplateId = PrivateWorkout, AssignedAt = Today });
            seed.SaveChanges();
        }
        (db, svc) = Workouts(AsMember());
        using (db) Assert.Contains(PrivateWorkout, (await svc.GetAllAsync(new WorkoutListRequest { PageSize = 100 })).Items.Select(w => w.Id));
        Assert.Equal("Secret day", (await StructureAsync(PrivateWorkout, AsMember())).WorkoutName);

        // Another member still can't.
        (db, svc) = Workouts(AsMember(Member2));
        using (db) Assert.DoesNotContain(PrivateWorkout, (await svc.GetAllAsync(new WorkoutListRequest { PageSize = 100 })).Items.Select(w => w.Id));
    }

    [Fact]
    public async Task Deleting_a_workout_in_use_is_refused()
    {
        using (var seed = _db.Create(null))
        {
            seed.WorkoutAssignments.Add(new WorkoutAssignment { TenantId = 1, ClientId = Member, TemplateId = PrivateWorkout, AssignedAt = Today });
            seed.SaveChanges();
        }
        var (db, svc) = Workouts(AsAdmin());
        using (db)
        {
            var ex = await Assert.ThrowsAsync<RuleException>(() => svc.DeleteAsync(PrivateWorkout));
            Assert.Equal("WORKOUT_IN_USE", ex.Code);
            Assert.True(await svc.DeleteAsync(PublicWorkout)); // unused
        }
    }

    [Fact]
    public async Task Structure_accepts_and_validates_set_targets()
    {
        var plan = NewPlan();
        var day = await DayAsync(plan, 1, 1, "Push");
        using (var db = _db.Create(AsAdmin()))
        {
            var svc = new WorkoutStructureService(db, AsAdmin());
            var saved = await svc.SaveStructureAsync(day.WorkoutId!.Value, new WorkoutStructureDto
            {
                Sections = [new SectionDto { Type = "Superset", Rounds = 3, Exercises = [new SectionExerciseDto
                {
                    ExerciseId = Bench,
                    SetTargets = [new() { Type = "warmup", RepsMin = 10, RepsMax = 10, WeightKg = 40 }, new() { RepsMin = 8, RepsMax = 12, WeightKg = 60, Rpe = 8, RestSec = 90 }],
                }] }],
            });
            var ex = saved.Sections.Single().Exercises.Single();
            Assert.Equal(2, ex.SetTargets!.Count);
            Assert.Equal("warmup", ex.SetTargets[0].Type);
            Assert.Equal((byte)2, ex.SetTargets[1].SetNo);
            Assert.Equal((byte)2, ex.Sets);
            Assert.Equal("10", ex.Reps);
            Assert.NotNull(ex.WorkoutExerciseId);

            await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveStructureAsync(day.WorkoutId.Value, new WorkoutStructureDto
            {
                Sections = [new SectionDto { Exercises = [new SectionExerciseDto { ExerciseId = Bench, SetTargets = Enumerable.Range(0, 21).Select(_ => new SetTargetDto { RepsMin = 5 }).ToList() }] }],
            }));
            await Assert.ThrowsAsync<ArgumentException>(() => svc.SaveStructureAsync(day.WorkoutId.Value, new WorkoutStructureDto
            {
                Sections = [new SectionDto { Exercises = [new SectionExerciseDto { ExerciseId = Bench, SetTargets = [new() { RepsMin = 5, WeightKg = 5000 }] }] }],
            }));
        }
    }

    [Fact]
    public async Task Plans_are_isolated_per_gym()
    {
        var plan = NewPlan();
        var (db, svc) = Builder(new FakeUser { UserId = OtherGymMember, Role = "admin", TenantId = 2 });
        using (db)
        {
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.GetBuilderAsync(plan));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.UpsertDayAsync(plan, 1, 1, new UpsertPlanDayRequest { Title = "X" }));
        }
        // An admin can't assign a member of another gym.
        await Assert.ThrowsAsync<ArgumentException>(() => AssignAsync(plan, OtherGymMember));
        // A member can't open a plan that isn't theirs.
        (db, svc) = Builder(AsMember());
        using (db) await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.GetBuilderAsync(plan));
    }

    [Fact]
    public async Task Trainer_edits_own_plans_and_own_clients_copies_only()
    {
        var othersPlan = NewPlan(createdBy: OtherTrainer);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => DayAsync(othersPlan, 1, 1, "Mine now", u: AsTrainer()));

        var myPlan = NewPlan(createdBy: Trainer);
        await DayAsync(myPlan, 1, 1, "Push", u: AsTrainer());
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => AssignAsync(myPlan, NotMyClient, u: AsTrainer()));

        // An admin assigns the other trainer's plan to my client: I can edit that client's copy.
        var a = (await AssignAsync(othersPlan, Member)).Single();
        var day = await DayAsync(a.PlanId, 1, 2, "Extra", u: AsTrainer());
        Assert.NotNull(day.WorkoutId);
        // …and the other trainer (not their client) can't.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => DayAsync(a.PlanId, 1, 3, "Nope", u: AsTrainer(OtherTrainer)));

        // Members list: trainers see their clients only.
        var (db, svc) = Builder(AsTrainer(OtherTrainer));
        using (db) Assert.Empty(await svc.GetMembersAsync(othersPlan));
        (db, svc) = Builder(AsTrainer());
        using (db) Assert.Single(await svc.GetMembersAsync(othersPlan));
        (db, svc) = Builder(AsTrainer());
        using (db) Assert.Equal(a.PlanId, (await svc.GetClientCopyAsync(a.AssignmentId)).PlanId);
        (db, svc) = Builder(AsTrainer(OtherTrainer));
        using (db) await Assert.ThrowsAsync<UnauthorizedAccessException>(() => svc.GetClientCopyAsync(a.AssignmentId));
    }

    [Fact]
    public async Task Old_schedule_endpoints_still_work()
    {
        var plan = NewPlan();
        var (db, svc) = Builder(AsAdmin());
        PlanScheduleDto saved;
        using (db) saved = await svc.SaveScheduleAsync(plan, new PlanScheduleDto
        {
            Weeks = [new PlanWeekDto { WeekNumber = 1, Days = [new PlanDayDto { DayNumber = 1, WorkoutId = PublicWorkout }, new PlanDayDto { DayNumber = 2 }] }],
        });
        var d1 = saved.Weeks.Single().Days.Single(d => d.DayNumber == 1);
        Assert.NotEqual(PublicWorkout, d1.WorkoutId); // copied into the day
        Assert.Equal("Chest day", d1.WorkoutName);
        Assert.True(saved.Weeks.Single().Days.Single(d => d.DayNumber == 2).IsRestDay);

        // Sending the same ids back keeps the day's workout.
        (db, svc) = Builder(AsAdmin());
        using (db) saved = await svc.SaveScheduleAsync(plan, saved);
        Assert.Equal(d1.WorkoutId, saved.Weeks.Single().Days.Single(d => d.DayNumber == 1).WorkoutId);
    }

    // ── Privacy ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Privacy_export_includes_set_logs_and_records()
    {
        var (db, svc) = Workouts(AsMember());
        using (db) await svc.CompleteAsync(PublicWorkout, Session(Set(Bench, 1, 5, 50)));
        using var pdb = _db.Create(null);
        var processor = new PrivacyProcessor(pdb, null!, new EmailOutbox(pdb), new Notifier(pdb, new FakeUser { UserId = null, IsAuthenticated = false }),
            NullLogger<PrivacyProcessor>.Instance);
        var export = await processor.CollectExportAsync(1, Member);
        Assert.Contains("workoutSetLogs", PrivacyProcessor.ExportSections);
        Assert.Contains("personalRecords", PrivacyProcessor.ExportSections);
        Assert.Single((System.Collections.ICollection)export["workoutSetLogs"]!);
        Assert.Equal(3, ((System.Collections.ICollection)export["personalRecords"]!).Count); // heaviest, e1RM, volume
    }
}

internal static class PlanBuilderTestExtensions
{
    public static Task<PlanBuilderDto> DuplicatePlanForTest(this PlanBuilderService svc, ulong plan) =>
        svc.DuplicateAsync(plan, new DuplicatePlanRequest());
}
