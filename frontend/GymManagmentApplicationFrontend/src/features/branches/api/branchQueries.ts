import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBranches, fetchBranch, createBranch, updateBranch, setBranchStatus, deleteBranch, transferBranch,
} from './branchApi';
import { queryKeys } from '../../../api/queryKeys';
import { BranchPayload, BranchUpdatePayload } from '../types/branch.types';

export const useBranches = () =>
  useQuery({
    queryKey: queryKeys.branches.all,
    queryFn:  fetchBranches,
    select:   (res) => res.data ?? [],
  });

export const useBranch = (id: number) =>
  useQuery({
    queryKey: [...queryKeys.branches.all, id],
    queryFn:  () => fetchBranch(id),
    select:   (res) => res.data,
    enabled:  id > 0,
  });

export const useUpdateBranch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BranchUpdatePayload }) => updateBranch(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.branches.all }),
  });
};

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
