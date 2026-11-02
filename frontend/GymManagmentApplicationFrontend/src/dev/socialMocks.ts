// Preview-mode answers for the social feed (/api/social). Return undefined to fall through.
// An in-memory feed with working likes, comments (add/edit/delete) and new posts, so the whole
// module can be clicked through without a backend. Resets on reload.

import type { SocialComment, SocialPost, SocialUser } from '../features/social/api/social.types';

const ok = <T,>(data: T) => ({ success: true, message: 'OK', data, errors: null });
const fail = (message: string) => ({ success: false, message, data: null, errors: null });
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const img = (id: string) => `https://images.unsplash.com/${id}?w=900&q=70&auto=format&fit=crop`;

const ME: SocialUser = { id: 1, name: 'Aarav Mehta', avatarUrl: null };
const PEOPLE: SocialUser[] = [
  { id: 2, name: 'Sara Khan', avatarUrl: null },
  { id: 3, name: 'Rohan Das', avatarUrl: null },
  { id: 4, name: 'Vikram Rao', avatarUrl: null },
  { id: 5, name: 'Nisha Pillai', avatarUrl: null },
];

let nextPost = 100;
let nextComment = 1000;
let nextImage = 5000;

interface Row { post: SocialPost; likedBy: Set<number>; comments: SocialComment[] }
const rows: Row[] = [];
const byId = (id: number) => rows.find(r => r.post.id === id);

function addComment(postId: number, user: SocialUser, text: string, hoursAgo: number): SocialComment {
  const c: SocialComment = {
    id: nextComment++, postId, text, createdAt: ago(hoursAgo), modifiedAt: ago(hoursAgo), isEdited: false,
    user, canEdit: false, canDelete: false,
  };
  byId(postId)?.comments.push(c);
  return c;
}

function seed(user: SocialUser, caption: string, hoursAgo: number, photos: string[], likers: number[], comments: [SocialUser, string, number][]) {
  const id = nextPost++;
  rows.unshift({
    likedBy: new Set(likers),
    comments: [],
    post: {
      id, caption, createdAt: ago(hoursAgo), user, likeCount: 0, commentCount: 0, likedByMe: false, canDelete: false,
      images: photos.map((p, i) => ({ id: nextImage++, url: img(p), thumbUrl: img(p), displayOrder: i })),
      commentsPreview: [],
    },
  });
  for (const [u, t, h] of comments) addComment(id, u, t, h);
}

// Oldest first, because seed() puts each new post at the top.
seed(PEOPLE[3], 'Sunday long run done. Legs are jelly but the sunrise was worth it.', 70, ['photo-1552674605-db6ffd4facb5'], [2, 3], [[PEOPLE[0], 'Beast mode!', 66]]);
seed(PEOPLE[2], 'Meal prep Sunday: chicken, rice, greens. Five lunches sorted.', 40, ['photo-1546069901-ba9599a7e63c', 'photo-1490645935967-10de6ba17061'], [1, 2, 4, 5], [[PEOPLE[1], 'Recipe please!', 38], [PEOPLE[3], 'Looks so good', 30]]);
seed(PEOPLE[1], 'New deadlift PR: 140 kg for a clean triple. Six months of patience.', 20, ['photo-1534438327276-14e5300c3a48', 'photo-1517836357463-d25dfeac3438', 'photo-1581009146145-b5ef050c2e1e'], [1, 3, 4], [
  [PEOPLE[0], 'Huge! Congrats Sara', 19], [PEOPLE[2], 'Form looked perfect', 18], [PEOPLE[3], 'Inspiring', 17], [ME, 'Next stop 150!', 16],
]);
seed(PEOPLE[0], 'Morning mobility flow before the shift. Ten minutes makes the whole day better.', 6, ['photo-1518611012118-696072aa579a'], [], []);

function view(r: Row): SocialPost {
  const live = r.comments;
  const mine = r.post.user.id === ME.id;
  const dress = (c: SocialComment): SocialComment => ({ ...c, canEdit: c.user.id === ME.id, canDelete: c.user.id === ME.id || mine });
  return {
    ...r.post,
    likeCount: r.likedBy.size,
    likedByMe: r.likedBy.has(ME.id),
    commentCount: live.length,
    commentsPreview: live.slice(-2).map(dress),
    canDelete: mine,
  };
}

type Body = Record<string, unknown> | undefined;

export function socialRoute(method: string, path: string, rawBody: unknown, query: URLSearchParams): unknown | undefined {
  const seg = path.split('/').filter(Boolean).slice(1); // drop 'social'
  const [a, b, c, d] = seg;
  const get = method === 'get';
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : undefined) as Body;

  // Feed (cursor = id of the oldest post already shown)
  if (a === 'posts' && !b && get) {
    const size = Math.max(1, Number(query.get('pageSize') ?? 8));
    const cursor = Number(query.get('cursor') ?? 0);
    const older = rows.filter(r => !cursor || r.post.id < cursor);
    const page = older.slice(0, size);
    return ok({ items: page.map(view), nextCursor: older.length > size ? page[page.length - 1].post.id : null, hasMore: older.length > size });
  }

  // New post (multipart)
  if (a === 'posts' && !b && method === 'post') {
    const form = rawBody as unknown;
    let caption = '';
    let files: File[] = [];
    if (typeof FormData !== 'undefined' && form instanceof FormData) {
      caption = String(form.get('caption') ?? '');
      files = form.getAll('images').filter((x): x is File => typeof x !== 'string');
    }
    if (files.length === 0) return fail('Add at least one photo.');
    if (caption.length > 2200) return fail('Caption can be at most 2200 characters.');
    const id = nextPost++;
    rows.unshift({
      likedBy: new Set(), comments: [],
      post: {
        id, caption: caption.trim() || null, createdAt: new Date().toISOString(), user: ME, likeCount: 0, commentCount: 0, likedByMe: false, canDelete: true,
        images: files.map((f, i) => { const u = URL.createObjectURL(f); return { id: nextImage++, url: u, thumbUrl: u, displayOrder: i }; }),
        commentsPreview: [],
      },
    });
    return ok(view(rows[0]));
  }

  if (a === 'posts' && b && !c) {
    const row = byId(Number(b));
    if (!row) return fail('Post not found.');
    if (get) return ok(view(row));
    if (method === 'delete') {
      if (row.post.user.id !== ME.id) return fail('You can only delete your own posts.');
      rows.splice(rows.indexOf(row), 1);
      return ok(null);
    }
  }

  // Likes
  if (a === 'posts' && b && c === 'like') {
    const row = byId(Number(b));
    if (!row) return fail('Post not found.');
    if (method === 'post') row.likedBy.add(ME.id);
    if (method === 'delete') row.likedBy.delete(ME.id);
    return ok({ postId: row.post.id, likedByMe: row.likedBy.has(ME.id), likeCount: row.likedBy.size });
  }

  // Comments
  if (a === 'posts' && b && c === 'comments') {
    const row = byId(Number(b));
    if (!row) return fail('Post not found.');
    const mine = row.post.user.id === ME.id;
    const dress = (x: SocialComment): SocialComment => ({ ...x, canEdit: x.user.id === ME.id, canDelete: x.user.id === ME.id || mine });
    if (get) {
      const size = Math.max(1, Number(query.get('pageSize') ?? 15));
      const pageNumber = Math.max(1, Number(query.get('pageNumber') ?? 1));
      const items = row.comments.slice((pageNumber - 1) * size, pageNumber * size).map(dress);
      return ok({ items, pageNumber, pageSize: size, totalRecords: row.comments.length, totalPages: Math.ceil(row.comments.length / size) });
    }
    if (method === 'post') {
      const text = String(body?.text ?? '').trim();
      if (!text) return fail('Comment can’t be empty.');
      if (text.length > 1000) return fail('Comment can be at most 1000 characters.');
      return ok(dress(addComment(row.post.id, ME, text, 0)));
    }
  }

  if (a === 'comments' && b) {
    const id = Number(b);
    const row = rows.find(r => r.comments.some(x => x.id === id));
    const comment = row?.comments.find(x => x.id === id);
    if (!row || !comment) return fail('Comment not found.');
    const mine = row.post.user.id === ME.id;
    if (method === 'put') {
      if (comment.user.id !== ME.id) return fail('You can only edit your own comments.');
      const text = String(body?.text ?? '').trim();
      if (!text) return fail('Comment can’t be empty.');
      comment.text = text; comment.modifiedAt = new Date().toISOString(); comment.isEdited = true;
      return ok({ ...comment, canEdit: true, canDelete: true });
    }
    if (method === 'delete') {
      if (comment.user.id !== ME.id && !mine) return fail('You can only delete your own comments, or comments on your own posts.');
      row.comments.splice(row.comments.indexOf(comment), 1);
      return ok(null);
    }
  }
  void d;
  return undefined;
}
