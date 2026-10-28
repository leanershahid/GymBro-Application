import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMembers, createMember, deleteMember, setMemberStatus } from './memberApi';
import { MemberPayload } from '../types/member.types';
import { queryKeys } from '../../../api/queryKeys';

export const useMembers = (query = '', pageNumber = 1, pageSize = 20) =>
  useQuery({
    queryKey: [...queryKeys.members.all, query, pageNumber, pageSize],
    queryFn:  () => fetchMembers(query, pageNumber, pageSize),
    select:   (res) => res.data,
  });

export const useCreateMember = () =>
  useMutation({ mutationFn: (payload: MemberPayload) => createMember(payload) });

export const useDeleteMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
};

export const useSetMemberStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => setMemberStatus(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.members.all }),
  });
};
