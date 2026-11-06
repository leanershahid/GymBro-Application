using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Member.Interfaces;
using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Application.Member.Responses;

namespace GymManagmentApplication.Application.Member.Services;

/// <summary>
/// Facade behind <see cref="IMemberService"/> (ARCH-023): the controller keeps one service while
/// the work lives in focused services — <see cref="MemberDirectoryService"/> (records, create,
/// status), <see cref="MemberFilesService"/> (photo, documents), <see cref="MemberNotesService"/>
/// and <see cref="MemberTagsService"/>. Data access is the DbContext plus
/// <see cref="MemberQueries"/>; the thin IMemberRepository is gone.
/// </summary>
public class MemberService(
    MemberDirectoryService directory,
    MemberFilesService files,
    MemberNotesService notes,
    MemberTagsService tags) : IMemberService
{
    public Task<PagedResponse<MemberResponse>> GetAllAsync(MemberSearchRequest request) => directory.GetAllAsync(request);
    public Task<MemberResponse> CreateAsync(CreateMemberRequest request) => directory.CreateAsync(request);
    public Task<MemberResponse?> GetByIdAsync(ulong id) => directory.GetByIdAsync(id);
    public Task<MemberResponse?> UpdateAsync(ulong id, UpdateMemberRequest request) => directory.UpdateAsync(id, request);
    public Task<bool> DeleteAsync(ulong id) => directory.DeleteAsync(id);
    public Task<bool> SetStatusAsync(ulong id, bool isActive) => directory.SetStatusAsync(id, isActive);
    public Task<List<MemberResponse>> BulkImportAsync(BulkImportMemberRequest request) => directory.BulkImportAsync(request);
    public Task<List<MemberTimelineResponse>> GetTimelineAsync(ulong id) => directory.GetTimelineAsync(id);
    public Task<PagedResponse<MemberResponse>> SearchAsync(MemberSearchRequest request) => directory.SearchAsync(request);

    public Task<string> UploadPhotoAsync(ulong id, FileUpload photo) => files.UploadPhotoAsync(id, photo);
    public Task<List<MemberDocumentResponse>> GetDocumentsAsync(ulong id) => files.GetDocumentsAsync(id);
    public Task<MemberDocumentResponse> UploadDocumentAsync(ulong id, FileUpload file, string? documentType) =>
        files.UploadDocumentAsync(id, file, documentType);

    public Task<List<MemberNoteResponse>> GetNotesAsync(ulong id) => notes.GetNotesAsync(id);
    public Task<MemberNoteResponse> AddNoteAsync(ulong id, AddMemberNoteRequest request) => notes.AddNoteAsync(id, request);

    public Task<List<string>> GetTagsAsync(ulong id) => tags.GetTagsAsync(id);
    public Task<bool> AssignTagsAsync(ulong id, AssignTagsRequest request) => tags.AssignTagsAsync(id, request);
}
