namespace GymManagmentApplication.Domain.Entities.Platform;

public class Taggable
{
    public ulong TagId { get; set; }
    public ulong TaggableId { get; set; }
    public string TaggableType { get; set; } = default!;

    public Tag Tag { get; set; } = default!;
}
