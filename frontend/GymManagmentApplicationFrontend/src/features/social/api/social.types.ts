// Shapes returned by /api/social (see SocialDtos.cs). Dates are ISO strings in UTC.

export interface SocialUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface SocialImage {
  id: number;
  url: string;
  thumbUrl: string;
  displayOrder: number;
}

export interface SocialComment {
  id: number;
  postId: number;
  text: string;
  createdAt: string;
  modifiedAt: string;
  isEdited: boolean;
  user: SocialUser;
  canEdit: boolean;
  canDelete: boolean;
}

export interface SocialPost {
  id: number;
  caption: string | null;
  createdAt: string;
  user: SocialUser;
  images: SocialImage[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /** The latest two comments, oldest first. */
  commentsPreview: SocialComment[];
  canDelete: boolean;
}

export interface SocialFeedPage {
  items: SocialPost[];
  nextCursor: number | null;
  hasMore: boolean;
}

export interface SocialLikeState {
  postId: number;
  likedByMe: boolean;
  likeCount: number;
}

export interface SocialCommentPage {
  items: SocialComment[];
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

/** A picked image, ready to upload. */
export interface SocialPickedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  width?: number;
  height?: number;
  fileSize?: number | null;
}

export const SOCIAL_LIMITS = {
  caption: 2200,
  comment: 1000,
  images: 10,
  imageBytes: 5 * 1024 * 1024,
  formats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
} as const;
