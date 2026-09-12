import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchLeads, createLead, convertLead } from './leadApi';
import { LeadPayload } from '../types/lead.types';
import { queryKeys } from '../../../api/queryKeys';

export const useLeads = (pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.leads.all, pageNumber, pageSize],
    queryFn:  () => fetchLeads(pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useCreateLead  = () => useMutation({ mutationFn: (p: LeadPayload) => createLead(p) });
export const useConvertLead = () => useMutation({ mutationFn: (id: number) => convertLead(id) });
