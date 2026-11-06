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
/// defined. <c>DbSeeder</c> upserts these rows by key on every boot, so
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
        // ── Admin (management) ─────────────────────────────────────────────
        // Main menu = the front desk's day: home, members, schedule, billing (as Glofox / PushPress).
        new("admin.home",     AdminApp, null, "Home",     "home",         "home",        "analytics,reports", 1),
        new("admin.members",  AdminApp, null, "Members",  "members",      "users",       "members,onboarding", 2),
        new("admin.classes",  AdminApp, null, "Schedule", "classes",      "calendar",    "classes", 3),
        new("admin.billing",  AdminApp, null, "Billing",  "billing",      "credit-card", "billing,invoices,payments,subscriptions,corporate", 4),
        new("admin.more",     AdminApp, null, "More",     "more-actions", "menu",        null, 5),

        new("admin.trainers",      AdminApp, "admin.more", "Trainers",      "trainers",            "user-check",   "trainers", 1),
        new("admin.pt-sessions",   AdminApp, "admin.more", "PT sessions",   "pt-sessions",         "clock",        "pt-sessions", 2),
        new("admin.attendance",    AdminApp, "admin.more", "Attendance",    "attendance",          "check-circle", "attendance", 3),
        new("admin.leads",         AdminApp, "admin.more", "Leads",         "leads",               "target",       "leads", 4),
        new("admin.workouts",      AdminApp, "admin.more", "Workouts",      "workouts",            "activity",     "workouts", 5),
        new("admin.plans",         AdminApp, "admin.more", "Plans",         "plans",               "book-open",    "plans,workout-automation", 6),
        new("admin.exercises",     AdminApp, "admin.more", "Exercises",     "exercises",           "zap",          "exercises", 7),
        new("admin.challenges",    AdminApp, "admin.more", "Challenges",    "challenges-admin",    "award",        "challenges,gamification", 8),
        new("admin.live-coaching", AdminApp, "admin.more", "Live Coaching", "live-coaching-admin", "video",        "live-coaching", 9),
        new("admin.stats",         AdminApp, "admin.more", "Stats",         "stats-admin",         "bar-chart-2",  "stats", 10),
        new("admin.ai-coach",      AdminApp, "admin.more", "AI Coach",      "ai-coach-admin",      "cpu",          "ai-insights", 11),
        new("admin.branches",      AdminApp, "admin.more", "Branches",      "branches",            "map-pin",      "branches", 12),
        new("admin.tenants",       AdminApp, "admin.more", "Tenants",       "tenants",             "briefcase",    "tenants", 13, AdminOnly: true),
        new("admin.roles",         AdminApp, "admin.more", "Roles",         "roles",               "shield",       "roles", 14, AdminOnly: true),
        new("admin.user-access",   AdminApp, "admin.more", "Access",        "user-access",         "lock",         "access", 15, AdminOnly: true),
        new("admin.shop",          AdminApp, "admin.more", "Shop",          "shop",                "shopping-bag", "shop", 16),
        new("admin.social",        AdminApp, "admin.more", "Social",        "social",              "image",        "social", 17),
        // Safety & compliance: manage waiver documents + gating settings; read members' health answers.
        new("admin.waivers",       AdminApp, "admin.more", "Waivers & health", "waivers",          "file-text",    "waivers", 18),
        new("admin.members.health", AdminApp, "admin.members", "Health answers", null,             "heart",        "health-screening", 1, HideFromMenu: true),
        // Gym operations: announcements to members/staff, service status notices, branch hours & info.
        new("admin.announcements",  AdminApp, "admin.more", "Announcements",  "announcements",     "volume-2",     "announcements", 19),
        new("admin.service-status", AdminApp, "admin.more", "Service status", "service-status",    "alert-triangle", "service-status", 20),
        // Member self-service: members' pause / cancel / plan-change requests + the gym's membership rules.
        new("admin.membership-requests", AdminApp, "admin.more", "Membership requests", "membership-requests", "inbox", "membership-requests", 22),
        // Help & feedback: members' support requests (queue, SLA, canned replies, FAQ) and class feedback.
        new("admin.support",        AdminApp, "admin.more", "Support",          "support",          "life-buoy",   "support", 23),
        // Facilities: the equipment register (status, service history), the problem-report queue and the
        // restricted incident log (admins by default; grantable per role, never part of a role template).
        new("admin.facilities",      AdminApp, "admin.more", "Equipment",       "facilities",       "tool",          "facilities", 24),
        new("admin.facility-reports", AdminApp, "admin.more", "Problem reports", "facility-reports", "alert-circle",  "facility-reports", 25),
        new("admin.incidents",       AdminApp, "admin.more", "Incident log",    "incidents",        "clipboard",     "incidents", 26),
        // Messaging: read-only safeguarding review of trainer ↔ member threads (every view audit-logged)
        // and the gym's messaging policy. Admins by default; grantable per role, never by a role template.
        new("admin.messages",        AdminApp, "admin.more", "Messages review", "messages-review",  "message-square", "messages-review", 28),
        // Privacy controls: members' deletion requests and data exports, privacy settings.
        new("admin.privacy",        AdminApp, "admin.more", "Privacy requests", "privacy-requests", "shield",      "privacy", 21, AdminOnly: true),
        new("admin.branches.hours", AdminApp, "admin.branches", "Hours & info", "branch-hours",    "clock",        "branch-hours", 1, HideFromMenu: true),

        new("admin.shop.dashboard",  AdminApp, "admin.shop", "Dashboard",  "dashboard",  "bar-chart-2", "shop", 1, IsTab: true),
        new("admin.shop.orders",     AdminApp, "admin.shop", "Orders",     "orders",     "package",     "shop", 2, IsTab: true),
        new("admin.shop.products",   AdminApp, "admin.shop", "Products",   "products",   "box",         "shop", 3, IsTab: true),
        new("admin.shop.categories", AdminApp, "admin.shop", "Categories", "categories", "folder",      "shop", 4, IsTab: true),
        new("admin.shop.inventory",  AdminApp, "admin.shop", "Inventory",  "inventory",  "layers",      "shop", 5, IsTab: true),
        new("admin.shop.coupons",    AdminApp, "admin.shop", "Coupons",    "coupons",    "tag",         "shop", 6, IsTab: true),
        new("admin.shop.customers",  AdminApp, "admin.shop", "Customers",  "customers",  "users",       "shop", 7, IsTab: true),
        new("admin.shop.settings",   AdminApp, "admin.shop", "Settings",   "settings",   "settings",    "shop", 8, IsTab: true),

        // ── Trainer (training) ─────────────────────────────────────────────
        // Main menu = the coach's day (as Wodify / Glofox): today, clients, sessions, classes.
        new("trainer.home",     TrainerApp, null, "Today",    "home",     "home",     null, 1),
        new("trainer.clients",  TrainerApp, null, "Clients",  "clients",  "users",    "members", 2),
        new("trainer.sessions", TrainerApp, null, "PT",       "sessions", "clock",    "pt-sessions", 3),
        new("trainer.classes",  TrainerApp, null, "Classes",  "classes",  "calendar", "classes", 4),
        new("trainer.programs", TrainerApp, null, "Programs", "builder",  "activity", null, 5),
        new("trainer.profile",  TrainerApp, null, "Profile",  "profile",  "user",     null, 6),

        new("trainer.programs.workouts",  TrainerApp, "trainer.programs", "Workouts",  "workouts",  "activity",  "workouts", 1, IsTab: true),
        new("trainer.programs.plans",     TrainerApp, "trainer.programs", "Plans",     "plans",     "book-open", "plans,workout-automation", 2, IsTab: true),
        new("trainer.programs.exercises", TrainerApp, "trainer.programs", "Exercises", "exercises", "zap",       "exercises", 3, IsTab: true),

        // ── Member ─────────────────────────────────────────────────────────
        // Main menu as PushPress / Trainerize: home, book, train, progress.
        new("member.home",      MemberApp, null, "Home",       "home",      "home",        null, 1),
        new("member.book",      MemberApp, null, "Book",       "book",      "calendar",    null, 2),
        new("member.train",     MemberApp, null, "Train",      "train",     "activity",    null, 3),
        new("member.progress",  MemberApp, null, "Progress",   "progress",  "trending-up", "plans", 4),
        new("member.shop",      MemberApp, null, "Shop",       "shop",      "shopping-bag", null, 5),
        new("member.social",    MemberApp, null, "Social",     "social",    "image",       "social", 6),
        new("member.community", MemberApp, null, "Community",  "community", "users",       null, 7),
        new("member.stats",     MemberApp, null, "Stats",      "stats",     "bar-chart-2", "stats", 8),
        new("member.billing",   MemberApp, null, "Membership", "billing",   "credit-card", "billing", 9),
        new("member.profile",   MemberApp, null, "Profile",    "profile",   "user",        null, 10),

        new("member.book.classes", MemberApp, "member.book", "Classes",           "classes", "calendar", "classes", 1, IsTab: true),
        new("member.book.mine",    MemberApp, "member.book", "My bookings",       "mine",    "list",     "classes,pt-sessions", 2, IsTab: true),
        new("member.book.pt",      MemberApp, "member.book", "Personal training", "pt",      "clock",    "pt-sessions", 3, IsTab: true),

        new("member.shop.store",    MemberApp, "member.shop", "Shop",     "store",    "shopping-bag", "shop", 1, IsTab: true),
        new("member.shop.cart",     MemberApp, "member.shop", "Cart",     "cart",     "shopping-cart", "shop", 2, IsTab: true),
        new("member.shop.wishlist", MemberApp, "member.shop", "Wishlist", "wishlist", "heart",         "shop", 3, IsTab: true),
        new("member.shop.orders",   MemberApp, "member.shop", "Orders",   "orders",   "package",       "shop", 4, IsTab: true),

        new("member.train.workouts",  MemberApp, "member.train", "Workouts",  "workouts",  "activity", "workouts", 1, IsTab: true),
        new("member.train.exercises", MemberApp, "member.train", "Exercises", "exercises", "zap",      "exercises", 2, IsTab: true),

        new("member.community.coaches",    MemberApp, "member.community", "Live coaching", "coaches",    "video", "live-coaching", 1, IsTab: true),
        new("member.community.challenges", MemberApp, "member.community", "Challenges",    "challenges", "award", "challenges", 2, IsTab: true),

        // Pages reached from inside Home, not from the menus.
        new("member.plans",    MemberApp, "member.home", "Plans",    "plans", "book-open", "plans", 1, HideFromMenu: true),
        new("member.ai-coach", MemberApp, "member.home", "AI Coach", null,    "cpu",       "ai-coach", 2, HideFromMenu: true),
        // Gym operations: the announcements feed and the branch info screen (hours, status, contact).
        // Their endpoints only return what was delivered to / is public for the caller, so no API key.
        new("member.announcements", MemberApp, "member.home", "Announcements", "announcements", "volume-2", null, 3, HideFromMenu: true),
        new("member.branch-info",   MemberApp, "member.home", "Gym info",      "branch-info",   "map-pin",  null, 4, HideFromMenu: true),
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
                              "member.billing", "member.profile", "member.social",
                              "member.shop", "member.shop.store", "member.shop.cart", "member.shop.wishlist", "member.shop.orders",
                              "member.announcements", "member.branch-info"],
        _                 => [],
    };

    public static string[] SplitApiModules(string? apiModules) =>
        string.IsNullOrWhiteSpace(apiModules)
            ? []
            : apiModules.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
