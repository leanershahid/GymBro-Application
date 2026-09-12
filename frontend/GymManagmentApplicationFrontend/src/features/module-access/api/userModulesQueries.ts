import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAllModules, fetchUserModules, setUserModules } from './userModulesApi';
import { ModuleToggle } from '../types/userModules.types';

const keys = {
  all: ['modules-all'] as const,
  forUser: (userId: number) => ['user-modules', userId] as const,
};

export const useAllModules = () =>
  useQuery({ queryKey: keys.all, queryFn: fetchAllModules, select: r => r.data ?? [] });

export const useUserModules = (userId: number) =>
  useQuery({
    queryKey: keys.forUser(userId),
    queryFn: () => fetchUserModules(userId),
    select: r => r.data ?? [],
    enabled: userId > 0,
    staleTime: 5 * 60 * 1000,
  });

export const useSetUserModules = (userId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modules: ModuleToggle[]) => setUserModules(userId, modules),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.forUser(userId) }),
  });
};
