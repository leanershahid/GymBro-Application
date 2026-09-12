namespace GymManagmentApplication.Application.Lead.Requests;

public class BulkImportLeadRequest
{
    public List<CreateLeadRequest> Leads { get; set; } = [];
}
