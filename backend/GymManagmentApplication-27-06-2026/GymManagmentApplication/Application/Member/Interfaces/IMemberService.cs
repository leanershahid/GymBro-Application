using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Application.Member.Responses;
using Microsoft.AspNetCore.Http;

namespace GymManagmentApplication.Application.Member.Interfaces;

public interface IMemberService
{
    Task<PagedResponse<MemberResponse>> GetAllAsync(MemberSearchRequest request);
    Task<MemberResponse> CreateAsync(CreateMemberRequest request);
    Task<MemberResponse?> GetByIdAsync(ulong id);
    Task<MemberResponse?> UpdateAsync(ulong id, UpdateMemberRequest request);
    Task<bool> DeleteAsync(ulong id);
    Task<List<MemberResponse>> BulkImportAsync(BulkImportMemberRequest request);
    Task<List<MemberTimelineResponse>> GetTimelineAsync(ulong id);
    Task<string> UploadPhotoAsync(ulong id, IFormFile photo);
    Task<List<MemberNoteResponse>> GetNotesAsync(ulong id);
    Task<MemberNoteResponse> AddNoteAsync(ulong id, AddMemberNoteRequest request);
    Task<List<MemberDocumentResponse>> GetDocumentsAsync(ulong id);
    Task<MemberDocumentResponse> UploadDocumentAsync(ulong id, IFormFile file, string? documentType);
    Task<PagedResponse<MemberResponse>> SearchAsync(MemberSearchRequest request);
    Task<List<string>> GetTagsAsync(ulong id);
    Task<bool> AssignTagsAsync(ulong id, AssignTagsRequest request);
}
