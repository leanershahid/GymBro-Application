import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchChallenges, createChallenge, updateChallengeStatus } from './challengeApi';
import { CreateChallengePayload, UpdateChallengeStatusPayload } from '../types/challenge.types';
import { queryKeys } from '../../../api/queryKeys';

export const useChallenges = () =>
  useQuery({
    queryKey: queryKeys.challenges.adminList,
    queryFn: fetchChallenges,
    select: (res) => res.data ?? [],
  });

export const useCreateChallenge = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChallengePayload) => createChallenge(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.challenges.adminList }),
  });
};

export const useUpdateChallengeStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateChallengeStatusPayload }) =>
      updateChallengeStatus(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.challenges.adminList }),
  });
};
