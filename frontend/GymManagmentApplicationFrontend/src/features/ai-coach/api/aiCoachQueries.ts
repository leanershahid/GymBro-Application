import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAiCoachSettings, saveAiCoachSettings } from './aiCoachApi';
import { AiCoachSettings } from '../types/aiCoach.types';
import { queryKeys } from '../../../api/queryKeys';

export const useAiCoachSettings = () =>
  useQuery({
    queryKey: queryKeys.aiCoach.settings,
    queryFn: fetchAiCoachSettings,
    select: (res) => res.data,
  });

export const useSaveAiCoachSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AiCoachSettings) => saveAiCoachSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.aiCoach.settings }),
  });
};
