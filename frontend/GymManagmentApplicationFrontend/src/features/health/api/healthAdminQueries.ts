import { useQuery } from '@tanstack/react-query';
import { fetchHealthAdminOverview } from './healthAdminApi';
import { queryKeys } from '../../../api/queryKeys';

export const useHealthAdminOverview = () =>
  useQuery({
    queryKey: queryKeys.health.adminOverview,
    queryFn: fetchHealthAdminOverview,
    select: (res) => res.data,
  });
