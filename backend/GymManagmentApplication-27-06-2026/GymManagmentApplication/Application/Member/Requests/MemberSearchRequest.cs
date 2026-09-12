namespace GymManagmentApplication.Application.Member.Requests;

public class MemberSearchRequest
{
    public string? Query { get; set; }
    public string? Status { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
