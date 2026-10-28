import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBranches, createBranch, setBranchStatus, deleteBranch, transferBranch } from './branchApi';
import { queryKeys } from '../../../api/queryKeys';
import { BranchPayload } from '../types/branch.types';

export const useBranches = () =>
  useQuery({
    queryKey: queryKeys.branches.all,
    queryFn:  fetchBranches,
    select:   (res) => res.data ?? [],
  });

export const useCreateBranch = () =>
  useMutation({
    mutationFn: (payload: BranchPayload) => createBranch(payload),
  });

export const useSetBranchStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'Active' | 'Inactive' }) => setBranchStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
};

export const useDeleteBranch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBranch(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
};

export const useTransferBranch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetBranchId }: { id: number; targetBranchId: number }) => transferBranch(id, targetBranchId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
};
