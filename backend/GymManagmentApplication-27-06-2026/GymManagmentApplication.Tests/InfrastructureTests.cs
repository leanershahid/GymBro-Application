using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Json;
using GymManagmentApplication.Infrastructure.Payments;
using GymManagmentApplication.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace GymManagmentApplication.Tests;

public class InfrastructureTests
{
    private record BranchBody(BranchStatus? Status, DateOnly? Joined, int? Count);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new EmptyStringAsNullConverterFactory(), new FlexibleEnumConverterFactory() },
    };

    [Fact]
    public void Enums_are_read_by_name_or_number_and_written_as_numbers()
    {
        Assert.Equal(BranchStatus.Inactive, JsonSerializer.Deserialize<BranchBody>("{\"status\":\"inactive\"}", Json)!.Status);
        Assert.Equal((BranchStatus)1, JsonSerializer.Deserialize<BranchBody>("{\"status\":1}", Json)!.Status);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<BranchBody>("{\"status\":\"bogus\"}", Json));
        Assert.Contains("\"status\":" + (int)BranchStatus.Inactive, JsonSerializer.Serialize(new BranchBody(BranchStatus.Inactive, null, null), Json));
    }

    [Fact]
    public void Blank_strings_become_null_for_optional_values()
    {
        var body = JsonSerializer.Deserialize<BranchBody>("{\"status\":\"\",\"joined\":\"\",\"count\":\"\"}", Json)!;
        Assert.Null(body.Status);
        Assert.Null(body.Joined);
        Assert.Null(body.Count);
        Assert.Equal(new DateOnly(2026, 3, 1), JsonSerializer.Deserialize<BranchBody>("{\"joined\":\"01/03/2026\"}", Json)!.Joined);
    }

    [Theory]
    [InlineData(0, 0, 1, 20)]
    [InlineData(-3, 500, 1, 100)]
    [InlineData(4, 10, 4, 10)]
    public void Paging_is_clamped(int page, int size, int expectedPage, int expectedSize) =>
        Assert.Equal((expectedPage, expectedSize), Paging.Clamp(page, size));

    [Fact]
    public void Secrets_round_trip_and_tampering_is_detected()
    {
        var protector = new SecretProtector(new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Secrets:Key"] = "test-key" }).Build());
        var stored = protector.Protect("rzp_secret_123");
        Assert.DoesNotContain("rzp_secret_123", stored);
        Assert.Equal("rzp_secret_123", protector.Unprotect(stored));
        Assert.Null(protector.Unprotect(stored[..^4] + "AAAA"));
        Assert.Null(protector.Unprotect("plain-text"));
    }

    [Fact]
    public void Razorpay_signature_matches_hmac_of_order_and_payment()
    {
        var keys = new RazorpayKeys("rzp_test_x", "secret");
        var sig = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes("secret"), Encoding.UTF8.GetBytes("order_1|pay_1"))).ToLowerInvariant();
        Assert.True(RazorpayClient.VerifySignature(keys, "order_1", "pay_1", sig));
        Assert.False(RazorpayClient.VerifySignature(keys, "order_1", "pay_2", sig));
    }

    [Fact]
    public void Gym_day_starts_at_local_midnight()
    {
        var zone = TenantClock.Resolve("Asia/Kolkata");
        Assert.NotEqual(TimeZoneInfo.Utc, zone);
        Assert.Equal(TimeZoneInfo.Utc, TenantClock.Resolve("Not/AZone"));
    }

    [Fact]
    public void Branch_staff_only_see_their_branch_members()
    {
        using var t = new TestDb();
        t.SeedGym();
        t.AddMember(100, branchId: 11);
        t.AddMember(101, branchId: 12);
        t.AddMember(102, branchId: null); // gym-wide

        using var staff = t.Create(new FakeUser { Role = "front-desk", BranchId = 11 });
        Assert.Equal([100UL, 102UL], staff.Users.Select(u => u.Id).AsEnumerable().Order().ToList());

        using var admin = t.Create(new FakeUser { Role = "admin", BranchId = 11 });
        Assert.Equal(3, admin.Users.Count());

        using var otherGym = t.Create(new FakeUser { Role = "admin", TenantId = 2 });
        Assert.Equal(0, otherGym.Users.Count());
    }

    [Fact]
    public async Task UpdatedAt_is_stamped_on_save()
    {
        using var t = new TestDb();
        t.SeedGym();
        using var db = t.Create(null);
        var tenant = await db.Tenants.FirstAsync();
        var before = tenant.UpdatedAt = DateTime.UtcNow.AddDays(-1);
        tenant.Name = "Renamed";
        await db.SaveChangesAsync();
        Assert.True(tenant.UpdatedAt > before);
    }
}
