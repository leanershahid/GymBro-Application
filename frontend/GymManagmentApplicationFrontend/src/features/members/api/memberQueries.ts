import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchMembers, createMember } from './memberApi';
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
