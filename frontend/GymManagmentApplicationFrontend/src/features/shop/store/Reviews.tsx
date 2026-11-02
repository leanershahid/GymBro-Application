import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { formatDate } from '../common/format';
import { ShopReview } from '../api/shop.types';
import { useDeleteReview, usePostReview, useReviews, useReviewSummary } from '../api/storeQueries';
import { ConfirmSheet, Field, SectionTitle, Stars, card } from './ui';

const RATING_WORD = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Your rating" style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          accessibilityRole="radio"
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}, ${RATING_WORD[n]}`}
          accessibilityState={{ checked: value === n }}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 28, color: n <= value ? T.brandGold : T.textDisabled }}>★</Text>
        </Pressable>
      ))}
      {value > 0 && <Text style={{ color: T.textSub, fontSize: 13, marginLeft: SP.sm }}>{RATING_WORD[value]}</Text>}
    </View>
  );
}

function ReviewForm({ productId, onDone }: { productId: number; onDone: () => void }) {
  const post = usePostReview();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<{ rating?: string; comment?: string; form?: string }>({});

  const submit = () => {
    const e = {
      rating: rating < 1 ? 'Choose 1 to 5 stars.' : undefined,
      comment: comment.trim().length < 10 ? 'Tell others a little more (at least 10 characters).' : undefined,
    };
    setErrors(e);
    if (e.rating || e.comment) return;
    post.mutate({ productId, rating, title: title.trim(), comment: comment.trim() }, {
      onSuccess: () => { toast.show({ message: 'Thanks — your review is live' }); onDone(); },
      onError: err => setErrors({ form: apiErrorText(err) }),
    });
  };

  return (
    <View style={[card, { padding: SP.lg, marginBottom: SP.lg }]}>
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: SP.sm }}>Write a review</Text>
      <StarPicker value={rating} onChange={n => { setRating(n); setErrors(x => ({ ...x, rating: undefined })); }} />
      {errors.rating && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 12, marginBottom: SP.sm }}>{errors.rating}</Text>}
      <Field label="Title" optional value={title} onChangeText={setTitle} maxLength={120} placeholder="Sums it up in a line" style={{ marginTop: SP.sm }} />
      <Field label="Your review" value={comment} onChangeText={t => { setComment(t); setErrors(x => ({ ...x, comment: undefined })); }} multiline maxLength={2000} placeholder="Taste, mixability, fit, quality…" error={errors.comment} />
      {errors.form && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13, marginBottom: SP.md }}>{errors.form}</Text>}
      <View style={{ flexDirection: 'row', gap: SP.sm }}>
        <PrimaryButton label="Cancel" variant="secondary" onPress={onDone} style={{ flex: 1, height: 48 }} disabled={post.isPending} />
        <PrimaryButton label="Post review" onPress={submit} loading={post.isPending} style={{ flex: 1, height: 48 }} />
      </View>
    </View>
  );
}

function ReviewItem({ review, onDelete }: { review: ShopReview; onDelete: () => void }) {
  return (
    <View style={{ paddingVertical: SP.md, borderTopWidth: 1, borderTopColor: T.line, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <Stars rating={review.rating} size={13} />
        {review.title ? <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: '700' }}>{review.title}</Text> : <View style={{ flex: 1 }} />}
        {review.isMine && (
          <Pressable onPress={onDelete} hitSlop={6} accessibilityRole="button" accessibilityLabel="Delete my review" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="trash-2" size={16} color={T.err} />
          </Pressable>
        )}
      </View>
      {review.comment ? <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>{review.comment}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SP.sm }}>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{review.isMine ? 'You' : review.authorName} · {formatDate(review.createdAt)}</Text>
        {review.isVerifiedPurchase && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Feather name="check-circle" size={12} color={T.ok} />
            <Text style={{ color: T.ok, fontSize: 11, fontWeight: '700' }}>Verified purchase</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function Reviews({ productId }: { productId: number }) {
  const summary = useReviewSummary(productId);
  const list = useReviews(productId);
  const remove = useDeleteReview();
  const toast = useToast();
  const [writing, setWriting] = useState(false);
  const [deleting, setDeleting] = useState<ShopReview | null>(null);

  const reviews = list.data?.pages.flatMap(p => p.items) ?? [];
  const mine = reviews.some(r => r.isMine);
  const s = summary.data;
  const total = s?.reviewCount ?? 0;

  return (
    <View>
      <SectionTitle title={`Reviews${total ? ` (${total})` : ''}`} />
      {summary.isPending && <Skeleton rows={1} height={110} borderRadius={R.lg} />}
      {s && total > 0 && (
        <View style={[card, { padding: SP.lg, flexDirection: 'row', gap: SP.lg, marginBottom: SP.lg }]}>
          <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 84 }}>
            <Text style={{ color: T.text, fontSize: 34, fontWeight: '800' }}>{s.averageRating.toFixed(1)}</Text>
            <Stars rating={s.averageRating} size={13} />
            <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 4 }}>{total} review{total === 1 ? '' : 's'}</Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
            {[5, 4, 3, 2, 1].map(n => {
              const c = s.distribution[String(n)] ?? 0;
              const pct = total ? c / total : 0;
              return (
                <View key={n} accessibilityLabel={`${n} stars: ${c}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: T.textSub, fontSize: 11, width: 10 }}>{n}</Text>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: T.bgInputActive, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: T.brandGold }} />
                  </View>
                  <Text style={{ color: T.textFaint, fontSize: 11, width: 22, textAlign: 'right' }}>{c}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!mine && list.data && (writing
        ? <ReviewForm productId={productId} onDone={() => setWriting(false)} />
        : (
          <Pressable
            onPress={() => setWriting(true)}
            accessibilityRole="button"
            accessibilityLabel="Write a review"
            style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', gap: SP.sm, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.brandBorder, backgroundColor: pressed ? withAlpha(T.brand, 0.16) : T.brandDim, marginBottom: SP.lg })}
          >
            <Feather name="edit-3" size={16} color={T.brand} />
            <Text style={{ color: T.brand, fontWeight: '700' }}>{total ? 'Write a review' : 'Be the first to review'}</Text>
          </Pressable>
        ))}

      {list.isError && <Text style={{ color: T.err, fontSize: 13 }}>{apiErrorText(list.error)}</Text>}
      {list.data && !reviews.length && <Text style={{ color: T.textFaint, fontSize: 13 }}>No reviews yet.</Text>}
      {reviews.map(r => <ReviewItem key={r.id} review={r} onDelete={() => setDeleting(r)} />)}
      {list.hasNextPage && (
        <PrimaryButton label="Show more reviews" variant="secondary" loading={list.isFetchingNextPage} onPress={() => list.fetchNextPage()} style={{ marginTop: SP.md, height: 48 }} />
      )}

      <ConfirmSheet
        visible={!!deleting}
        title="Delete your review?"
        message="Your rating and comment will be removed from this product. You can write a new one later."
        confirmLabel="Delete review"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id, productId }, {
          onSuccess: () => { setDeleting(null); toast.show({ message: 'Review deleted' }); },
          onError: e => { setDeleting(null); toast.show({ type: 'error', message: apiErrorText(e) }); },
        })}
      />
    </View>
  );
}
