import { ApiResponse } from '../../../api/types';

export type { ApiResponse };

export interface Role {
  /** Numeric id serialised as a string by the API. */
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  description?: string | null;
  permissions?: string[];
  createdAt?: string;
}
