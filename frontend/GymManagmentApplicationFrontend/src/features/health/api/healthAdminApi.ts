import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../api/endpoints';
import { ApiResponse, HealthAdminOverviewResponse } from '../types/health.types';

export const fetchHealthAdminOverview = async (): Promise<ApiResponse<HealthAdminOverviewResponse>> => {
  const { data } = await axiosInstance.get<ApiResponse<HealthAdminOverviewResponse>>(
    ENDPOINTS.HEALTH_ADMIN_OVERVIEW,
  );
  return data;
};
