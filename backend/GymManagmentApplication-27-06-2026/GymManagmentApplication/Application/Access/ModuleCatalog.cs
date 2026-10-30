using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Application.Access;

/// <summary>One row of the module master, as seeded.</summary>
/// <param name="Route">Screen key the app opens (tab key for tab rows; null = no screen of its own).</param>
/// <param name="ApiModules">Comma-separated API permission keys the module unlocks.</param>
public record ModuleDef(
    string Key, string App, string? ParentKey, string Name, string? Route, string Icon,
    string? ApiModules, int SortOrder,
    bool HideFromMenu = false, bool IsTab = false, bool AdminOnly = false);

/// <summary>
/// The module master for all three apps — the single place menus, tabs and their API keys are
/// defined. <see cref="Infrastructure.Data.DbSeeder"/> upserts these rows by key on every boot, so
/// adding or moving a module is an edit here; granting it is done per role/user from the admin app.
/// Container rows whose content lives in tabs (Book, Programs, …) carry no API keys themselves —
/// their tabs do — so granting a container alone never opens an API.
/// </summary>
public static class ModuleCatalog
{
    public const string AdminApp = "admin";
    public const string TrainerApp = "trainer";
    public const string MemberApp = "member";

    public static readonly ModuleDef[] All =
    [
        // ── Admin app ──────────────────────────────────────────────────────
        new("admin.home",     AdminApp, null, "Dashboard", "home",         "home",     "analytics,reports", 1),
        new("admin.members",  AdminApp, null, "Members",   "members",      "users",    "members,onboarding", 2),
        new("admin.hub",      AdminApp, null, "Hub",       "module-hub",   "grid",     null, 3),
        new("admin.workouts", AdminApp, null, "Activity",  "workouts",     "activity", "workouts", 4),
        new("admin.more",     AdminApp, null, "More",      "more-actions", "menu",     null, 5),

        new("admin.trainers",      AdminApp, "admin.more", "Trainers",      "trainers",            "award",       "trainers", 1),
        new("admin.branches",      AdminApp, "admin.more", "Branches",      "branches",            "map-pin",     "branches", 2),
        new("admin.tenants",       AdminApp, "admin.more", "Tenants",       "tenants",             "briefcase",   "tenants", 3, AdminOnly: true),
        new("admin.leads",         AdminApp, "admin.more", "Leads",         "leads",               "target",      "leads", 4),
        new("admin.billing",       AdminApp, "admin.more", "Billing",       "billing",             "credit-card", "billing,invoices,payments,subscriptions,corporate", 5),
        new("admin.classes",       AdminApp, "admin.more", "Classes",       "classes",             "calendar",    "classes", 6),
        new("admin.pt-sessions",   AdminApp, "admin.more", "PT",            "pt-sessions",         "clock",       "pt-sessions", 7),
        new("admin.exercises",     AdminApp, "admin.more", "Exercises",     "exercises",           "zap",         "exercises", 8),
        new("admin.plans",         AdminApp, "admin.more", "Plans",         "plans",               "book-open",   "plans,workout-automation", 9),
        new("admin.challenges",    AdminApp, "admin.more", "Challenges",    "challenges-admin",    "award",       "challenges,gamification", 10),
        new("admin.stats",         AdminApp, "admin.more", "Stats",         "stats-admin",         "bar-chart-2", "stats", 11),
        new("admin.live-coaching", AdminApp, "admin.more", "Live Coaching", "live-coaching-admin", "video",       "live-coaching", 12),
        new("admin.ai-coach",      AdminApp, "admin.more", "AI Coach",      "ai-coach-admin",      "cpu",         "ai-insights", 13),
        new("admin.attendance",    AdminApp, "admin.more", "Attendance",    "attendance",          "map-pin",     "attendance", 14),
        new("admin.roles",         AdminApp, "admin.more", "Roles",         "roles",               "shield",      "roles", 15, AdminOnly: true),
        new("admin.user-access",   AdminApp, "admin.more", "Access",        "user-access",         "lock",        "access", 16, AdminOnly: true),

        // ── Trainer app ────────────────────────────────────────────────────
        new("trainer.home",     TrainerApp, null, "Today",    "home",     "home",     null, 1),
        new("trainer.clients",  TrainerApp, null, "Clients",  "clients",  "users",    "members", 2),
        new("trainer.sessions", TrainerApp, null, "PT",       "sessions", "clock",    "pt-sessions", 3),
        new("trainer.classes",  TrainerApp, null, "Classes",  "classes",  "calendar", "classes", 4),
        new("trainer.programs", TrainerApp, null, "Programs", "builder",  "activity", null, 5),
        new("trainer.profile",  TrainerApp, null, "Profile",  "profile",  "user",     null, 6),

        new("trainer.programs.workouts",  TrainerApp, "trainer.programs", "Workouts",  "workouts",  "activity",  "workouts", 1, IsTab: true),
        new("trainer.programs.plans",     TrainerApp, "trainer.programs", "Plans",     "plans",     "book-open", "plans,workout-automation", 2, IsTab: true),
        new("trainer.programs.exercises", TrainerApp, "trainer.programs", "Exercises", "exercises", "zap",       "exercises", 3, IsTab: true),

        // ── Member app ─────────────────────────────────────────────────────
        new("member.home",      MemberApp, null, "Home",      "home",      "home",        null, 1),
        new("member.book",      MemberApp, null, "Book",      "book",      "calendar",    null, 2),
        new("member.community", MemberApp, null, "Community", "community", "users",       null, 3),
        new("member.stats",     MemberApp, null, "Stats",     "stats",     "bar-chart-2", "stats", 4),
        new("member.progress",  MemberApp, null, "Progress",  "progress",  "trending-up", "plans", 5),
        new("member.profile",   MemberApp, null, "Profile",   "profile",   "user",        null, 6),

        new("member.book.classes", MemberApp, "member.book", "Classes",           "classes", "calendar", "classes", 1, IsTab: true),
        new("member.book.mine",    MemberApp, "member.book", "My bookings",       "mine",    "list",     "classes,pt-sessions", 2, IsTab: true),
        new("member.book.pt",      MemberApp, "member.book", "Personal training", "pt",      "clock",    "pt-sessions", 3, IsTab: true),

        new("member.community.coaches",    MemberApp, "member.community", "Live coaching", "coaches",    "video", "live-coaching", 1, IsTab: true),
        new("member.community.challenges", MemberApp, "member.community", "Challenges",    "challenges", "award", "challenges", 2, IsTab: true),

        // Pages reached from inside Home, not from the tab bar.
        new("member.train",    MemberApp, "member.home", "Train",    "train",   "activity",    null, 1, HideFromMenu: true),
        new("member.plans",    MemberApp, "member.home", "Plans",    "plans",   "book-open",   "plans", 2, HideFromMenu: true),
        new("member.billing",  MemberApp, "member.home", "Billing",  "billing", "credit-card", "billing", 3, HideFromMenu: true),
        new("member.ai-coach", MemberApp, "member.home", "AI Coach", null,      "cpu",         "ai-coach", 4, HideFromMenu: true),

        new("member.train.workouts",  MemberApp, "member.train", "Workouts",  "workouts",  "activity", "workouts", 1, IsTab: true),
        new("member.train.exercises", MemberApp, "member.train", "Exercises", "exercises", "zap",      "exercises", 2, IsTab: true),
    ];

    /// <summary>The app a user signs in to, from their primary role.</summary>
    public static string AppForRole(string roleSlug) => roleSlug.ToLowerInvariant() switch
    {
        RoleNames.Trainer => TrainerApp,
        RoleNames.Client  => MemberApp,
        _                 => AdminApp,
    };

    /// <summary>
    /// Modules a built-in role starts with when it is created (and once, when this module master
    /// replaced the old access tables). They match what each app showed before: trainers and
    /// members keep their always-on tabs; feature areas they used to need a per-person switch for
    /// still need one (or a role grant). Staff and custom roles start with nothing.
    /// </summary>
    public static IEnumerable<string> DefaultKeysFor(string roleSlug) => roleSlug.ToLowerInvariant() switch
    {
        RoleNames.Admin   => All.Where(m => m.App == AdminApp).Select(m => m.Key),
        RoleNames.Trainer => ["trainer.home", "trainer.clients", "trainer.sessions", "trainer.classes", "trainer.profile"],
        RoleNames.Client  => ["member.home", "member.book", "member.book.classes", "member.book.mine", "member.book.pt",
                              "member.billing", "member.profile"],
        _                 => [],
    };

    public static string[] SplitApiModules(string? apiModules) =>
        string.IsNullOrWhiteSpace(apiModules)
            ? []
            : apiModules.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
