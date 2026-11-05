import axiosInstance from '../../../api/axios';
import { ApiResponse } from '../../../api/types';
import { unwrap } from '../../../api/http';
import { appendFile, postMultipart } from '../../../api/upload';
import {
  SocialFeedPage, SocialPost, SocialLikeState, SocialComment, SocialCommentPage, SocialPickedImage,
} from './social.types';

// Raw calls for /api/social. Each returns the envelope's `data`, or throws its message so
// React Query surfaces it as an error (same approach as the shop API).

const BASE = '/social';

export const fetchFeed = async (cursor?: number, pageSize = 8): Promise<SocialFeedPage> =>
  unwrap((await axiosInstance.get<ApiResponse<SocialFeedPage>>(`${BASE}/posts`, {
    params: { pageSize, ...(cursor ? { cursor } : {}) },
  })).data);

export const fetchPost = async (postId: number): Promise<SocialPost> =>
  unwrap((await axiosInstance.get<ApiResponse<SocialPost>>(`${BASE}/posts/${postId}`)).data);

export const deletePost = async (postId: number): Promise<void> => {
  unwrap((await axiosInstance.delete<ApiResponse<null>>(`${BASE}/posts/${postId}`)).data);
};

export const likePost = async (postId: number): Promise<SocialLikeState> =>
  unwrap((await axiosInstance.post<ApiResponse<SocialLikeState>>(`${BASE}/posts/${postId}/like`)).data);

export const unlikePost = async (postId: number): Promise<SocialLikeState> =>
  unwrap((await axiosInstance.delete<ApiResponse<SocialLikeState>>(`${BASE}/posts/${postId}/like`)).data);

export const fetchComments = async (postId: number, pageNumber: number, pageSize = 15): Promise<SocialCommentPage> =>
  unwrap((await axiosInstance.get<ApiResponse<SocialCommentPage>>(`${BASE}/posts/${postId}/comments`, {
    params: { pageNumber, pageSize },
  })).data);

export const addComment = async (postId: number, text: string): Promise<SocialComment> =>
  unwrap((await axiosInstance.post<ApiResponse<SocialComment>>(`${BASE}/posts/${postId}/comments`, { text })).data);

export const updateComment = async (commentId: number, text: string): Promise<SocialComment> =>
  unwrap((await axiosInstance.put<ApiResponse<SocialComment>>(`${BASE}/comments/${commentId}`, { text })).data);

export const deleteComment = async (commentId: number): Promise<void> => {
  unwrap((await axiosInstance.delete<ApiResponse<null>>(`${BASE}/comments/${commentId}`)).data);
};

/** multipart/form-data with several `images` parts, reporting upload progress (0–1). */
export async function createPost(
  caption: string,
  images: SocialPickedImage[],
  onProgress?: (fraction: number) => void,
): Promise<SocialPost> {
  const form = new FormData();
  form.append('caption', caption);
  for (let i = 0; i < images.length; i++) await appendFile(form, 'images', images[i], `photo-${i + 1}`);
  return unwrap(await postMultipart<SocialPost>(`${BASE}/posts`, form, { onProgress }));
}
