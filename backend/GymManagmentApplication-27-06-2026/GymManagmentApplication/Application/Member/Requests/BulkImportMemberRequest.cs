namespace GymManagmentApplication.Application.Member.Requests;

public class BulkImportMemberRequest
{
    public List<CreateMemberRequest> Members { get; set; } = [];
}
