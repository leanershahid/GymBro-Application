// ─── Shared API response envelopes ───────────────────────────────────
// Every backend endpoint responds with this envelope shape. Feature-level
// type files should import these instead of redefining them locally.

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: string[] | null;
}

export interface PaginatedData<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}
