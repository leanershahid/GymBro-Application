namespace GymManagmentApplication.Application.Member.Responses;

public class MemberDocumentResponse
{
    public ulong Id { get; set; }
    public string FileName { get; set; } = default!;
    public string Url { get; set; } = default!;
    public string? DocumentType { get; set; }
    public DateTime UploadedAt { get; set; }
}
