import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import {
  fetchFeed, fetchComments, likePost, unlikePost, addComment, updateComment, deleteComment, deletePost, createPost,
} from './socialApi';
import { SocialFeedPage, SocialPost, SocialComment, SocialCommentPage, SocialPickedImage } from './social.types';

export const socialKeys = {
  all: ['social'] as const,
  feed: ['social', 'feed'] as const,
  comments: (postId: number) => ['social', 'comments', postId] as const,
};

type Feed = InfiniteData<SocialFeedPage, number | undefined>;

/** Applies `fn` to one post wherever the feed cache holds it. */
function patchPost(qc: QueryClient, postId: number, fn: (p: SocialPost) => SocialPost) {
  qc.setQueryData<Feed>(socialKeys.feed, old => old && {
    ...old,
    pages: old.pages.map(pg => ({ ...pg, items: pg.items.map(p => (p.id === postId ? fn(p) : p)) })),
  });
}

// ── Feed ─────────────────────────────────────────────────────────────────

/** Newest first; each page's `nextCursor` asks for older posts, so new posts never shift pages. */
export const useFeed = () =>
  useInfiniteQuery({
    queryKey: socialKeys.feed,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    getNextPageParam: last => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

export const useCreatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { caption: string; images: SocialPickedImage[]; onProgress?: (f: number) => void }) =>
      createPost(v.caption, v.images, v.onProgress),
    onSuccess: post => {
      // Show it at the top at once, without refetching the whole feed.
      qc.setQueryData<Feed>(socialKeys.feed, old => old
        ? { ...old, pages: old.pages.map((pg, i) => (i === 0 ? { ...pg, items: [post, ...pg.items.filter(p => p.id !== post.id)] } : pg)) }
        : old);
      qc.invalidateQueries({ queryKey: socialKeys.feed });
    },
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: (_d, postId) => {
      qc.setQueryData<Feed>(socialKeys.feed, old => old && {
        ...old, pages: old.pages.map(pg => ({ ...pg, items: pg.items.filter(p => p.id !== postId) })),
      });
    },
  });
};

// ── Likes (optimistic) ───────────────────────────────────────────────────

export const useToggleLike = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { postId: number; like: boolean }) => (v.like ? likePost(v.postId) : unlikePost(v.postId)),
    onMutate: async ({ postId, like }) => {
      await qc.cancelQueries({ queryKey: socialKeys.feed });
      const previous = qc.getQueryData<Feed>(socialKeys.feed);
      patchPost(qc, postId, p => (p.likedByMe === like ? p : { ...p, likedByMe: like, likeCount: Math.max(0, p.likeCount + (like ? 1 : -1)) }));
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(socialKeys.feed, ctx.previous); },
    // The server's count is the truth (other people may have liked meanwhile).
    onSuccess: s => patchPost(qc, s.postId, p => ({ ...p, likedByMe: s.likedByMe, likeCount: s.likeCount })),
  });
};

// ── Comments ─────────────────────────────────────────────────────────────

export const useComments = (postId: number, enabled = true) =>
  useInfiniteQuery({
    queryKey: socialKeys.comments(postId),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchComments(postId, pageParam),
    getNextPageParam: last => (last.pageNumber < last.totalPages ? last.pageNumber + 1 : undefined),
    enabled,
  });

type Comments = InfiniteData<SocialCommentPage, number>;

export const useAddComment = (postId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addComment(postId, text),
    onSuccess: c => {
      // Chronological list: the new comment goes on the last loaded page.
      qc.setQueryData<Comments>(socialKeys.comments(postId), old => old && {
        ...old,
        pages: old.pages.map((pg, i) => (i === old.pages.length - 1
          ? { ...pg, items: [...pg.items, c], totalRecords: pg.totalRecords + 1 } : { ...pg, totalRecords: pg.totalRecords + 1 })),
      });
      patchPost(qc, postId, p => ({ ...p, commentCount: p.commentCount + 1, commentsPreview: [...p.commentsPreview, c].slice(-2) }));
    },
  });
};

export const useUpdateComment = (postId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { commentId: number; text: string }) => updateComment(v.commentId, v.text),
    onSuccess: c => {
      const swap = (list: SocialComment[]) => list.map(x => (x.id === c.id ? c : x));
      qc.setQueryData<Comments>(socialKeys.comments(postId), old => old && {
        ...old, pages: old.pages.map(pg => ({ ...pg, items: swap(pg.items) })),
      });
      patchPost(qc, postId, p => ({ ...p, commentsPreview: swap(p.commentsPreview) }));
    },
  });
};

export const useDeleteComment = (postId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: (_d, commentId) => {
      qc.setQueryData<Comments>(socialKeys.comments(postId), old => old && {
        ...old,
        pages: old.pages.map(pg => ({ ...pg, items: pg.items.filter(x => x.id !== commentId), totalRecords: Math.max(0, pg.totalRecords - 1) })),
      });
      patchPost(qc, postId, p => ({ ...p, commentCount: Math.max(0, p.commentCount - 1), commentsPreview: p.commentsPreview.filter(x => x.id !== commentId) }));
      // The preview may now be missing an older comment: let the feed refresh quietly.
      qc.invalidateQueries({ queryKey: socialKeys.feed });
    },
  });
};
