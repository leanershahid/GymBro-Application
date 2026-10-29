import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLeads, fetchLead, fetchLeadSources, createLead, convertLead } from './leadApi';
import { LeadPayload } from '../types/lead.types';
import { queryKeys } from '../../../api/queryKeys';

export const useLeads = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.leads.all, pageNumber, pageSize],
    queryFn:  () => fetchLeads(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useLead = (id: number | null) =>
  useQuery({
    queryKey: [...queryKeys.leads.all, 'detail', id],
    queryFn:  () => fetchLead(id as number),
    select:   (res) => res.data,
    enabled:  !!id,
  });

/** Sources already in use (admin only — trainers get 403, so failures are silent). */
export const useLeadSources = (enabled = true) =>
  useQuery({
    queryKey: [...queryKeys.leads.all, 'sources'],
    queryFn:  fetchLeadSources,
    select:   (res) => res.data ?? [],
    retry:    false,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

export const useCreateLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: LeadPayload) => createLead(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.leads.all }),
  });
};

export const useConvertLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => convertLead(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.leads.all }),
  });
};
