namespace GymManagmentApplication.Application.Common;

/// <summary>Shared request body for activate/deactivate endpoints (members, trainers).</summary>
public class SetStatusRequest
{
    public required bool IsActive { get; set; }
}
