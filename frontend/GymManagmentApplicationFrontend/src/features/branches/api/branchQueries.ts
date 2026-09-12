import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchBranches, createBranch } from './branchApi';
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
