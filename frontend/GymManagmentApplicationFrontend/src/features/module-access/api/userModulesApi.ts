import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse, ModuleDefinition, UserModuleAccessEntry, ModuleToggle } from '../types/userModules.types';

export const fetchAllModules = async (): Promise<ApiResponse<ModuleDefinition[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<ModuleDefinition[]>>(ENDPOINTS.USER_MODULES);
  return data;
};

export const fetchUserModules = async (userId: number): Promise<ApiResponse<UserModuleAccessEntry[]>> => {
  const { data } = await axiosInstance.get<ApiResponse<UserModuleAccessEntry[]>>(ENDPOINTS.userModulesFor(userId));
  return data;
};

export const setUserModules = async (
  userId: number, modules: ModuleToggle[],
): Promise<ApiResponse<UserModuleAccessEntry[]>> => {
  const { data } = await axiosInstance.put<ApiResponse<UserModuleAccessEntry[]>>(
    ENDPOINTS.userModulesFor(userId),
    { modules },
  );
  return data;
};
