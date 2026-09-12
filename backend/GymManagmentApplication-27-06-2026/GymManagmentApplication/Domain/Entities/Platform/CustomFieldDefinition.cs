using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class CustomFieldDefinition
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string EntityType { get; set; } = default!;
    public string FieldKey { get; set; } = default!;
    public string Label { get; set; } = default!;
    public CustomFieldType FieldType { get; set; } = CustomFieldType.Text;
    public JsonDocument? Options { get; set; }
    public bool IsRequired { get; set; }
    public ushort SortOrder { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
