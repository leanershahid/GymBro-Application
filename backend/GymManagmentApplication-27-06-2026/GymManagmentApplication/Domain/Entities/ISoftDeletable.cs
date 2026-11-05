namespace GymManagmentApplication.Domain.Entities;

/// <summary>
/// An entity that is soft-deleted by stamping <see cref="DeletedAt"/> (the one soft-delete
/// convention; the social tables' older IsDeleted flag is the exception). Query with
/// <c>.NotDeleted()</c> (Infrastructure.Data.QueryExtensions) instead of hand-writing the predicate.
/// </summary>
public interface ISoftDeletable
{
    DateTime? DeletedAt { get; set; }
}
