import { ApiResponse } from '../../../api/types';

export type { ApiResponse };

export interface ModuleDefinition {
  id: number;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export interface UserModuleAccessEntry extends ModuleDefinition {
  moduleId: number;
  isEnabled: boolean;
  grantedAt: string | null;
}

export interface ModuleToggle {
  key: string;
  isEnabled: boolean;
}
