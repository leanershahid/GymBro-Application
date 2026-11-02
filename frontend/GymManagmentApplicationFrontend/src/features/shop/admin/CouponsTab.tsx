import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { T, SP } from '../../../theme';
import Skeleton from '../../common/components/Skeleton';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field, SwitchRow, RowGrid, GridCell } from '../../trainers/components/FormFields';
import { DateField } from '../../trainers/components/DatePicker';
import { useApiAccess } from '../../access/context/AccessContext';
import { apiErrorText } from '../../../api/apiError';
import { useAdminCoupons, useDeleteCoupon, useSaveCoupon } from '../api/adminQueries';
import { ShopCoupon } from '../api/shop.types';
import { formatDate, formatPrice } from '../common/format';
import {
  ChipRow, ConfirmSheet, ErrorView, FormSheet, IconButton, RowCard, SmallButton, copyText, decimalOnly,
} from './components/kit';

const PERCENT = 0;
const FIXED = 1;

/** Live / Scheduled / Expired / Used up / Off, worked out on the device. */
export function couponState(c: ShopCoupon): { label: string; tone: PillTone } {
  const now = Date.now();
  if (!c.isActive) return { label: 'Off', tone: 'neutral' };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { label: 'Expired', tone: 'err' };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'warn' };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: 'Used up', tone: 'err' };
  return { label: 'Live', tone: 'ok' };
}

export const couponDiscount = (c: Pick<ShopCoupon, 'discountType' | 'value' | 'maxDiscountAmount'>) =>
  c.discountType === PERCENT
    ? `${c.value}%${c.maxDiscountAmount ? ` up to ${formatPrice(c.maxDiscountAmount)}` : ''}`
    : `${formatPrice(c.value)} off`;

export default function CouponsTab() {
  const { canCreate, canEdit, canDelete } = useApiAccess('shop');
  const toast = useToast();
  const { data, isPending, isError, error, refetch, isRefetching } = useAdminCoupons();
  const remove = useDeleteCoupon();
  const [editing, setEditing] = useState<ShopCoupon | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ShopCoupon | null>(null);

  const copy = async (code: string) => { if (await copyText(code)) toast.show({ message: `${code} copied` }); };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
    >
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>Discount codes members can apply at checkout.</Text>
      {canCreate && <SmallButton label="New coupon" icon="plus" variant="brand" onPress={() => setEditing('new')} style={{ alignSelf: 'flex-start', marginBottom: SP.lg }} />}

      {isPending ? <Skeleton rows={3} height={120} />
        : isError ? <ErrorView error={error} onRetry={refetch} />
        : !data.length ? (
          <EmptyState icon="tag" title="No coupons yet" action={canCreate ? { label: 'Create a coupon', onPress: () => setEditing('new') } : undefined} />
        ) : data.map(c => {
          const s = couponState(c);
          return (
            <RowCard key={c.id} onPress={canEdit ? () => setEditing(c) : undefined} label={`Edit ${c.code}`}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SP.xs }}>
                    <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', letterSpacing: 1 }}>{c.code}</Text>
                    <IconButton icon="copy" label={`Copy ${c.code}`} onPress={() => copy(c.code)} />
                    <StatusPill label={s.label} tone={s.tone} dot />
                  </View>
                  {!!c.description && <Text numberOfLines={2} style={{ color: T.textSub, fontSize: 13 }}>{c.description}</Text>}
                  <Text style={{ color: T.brand, fontSize: 15, fontWeight: '800', marginTop: 4 }}>{couponDiscount(c)}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
                    {c.minOrderAmount ? `Min ${formatPrice(c.minOrderAmount)}` : 'No minimum'}
                    {c.endsAt ? ` · Until ${formatDate(c.endsAt)}` : ''}
                  </Text>
                  <Text style={{ color: T.textFaint, fontSize: 12 }}>
                    Used {c.usedCount}{c.usageLimit !== null ? ` / ${c.usageLimit}` : ''}
                  </Text>
                </View>
                {canDelete && <IconButton icon="trash-2" label={`Delete ${c.code}`} tone={T.err} onPress={() => setDeleting(c)} />}
              </View>
            </RowCard>
          );
        })}

      {editing !== null && <CouponSheet key={editing === 'new' ? 'new' : editing.id} coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmSheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.code ?? 'coupon'}?`}
        message="Members can no longer use this code. Orders that already used it are unaffected."
        confirmLabel="Delete coupon"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => toast.show({ message: `${deleting.code} deleted` }),
          onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
          onSettled: () => setDeleting(null),
        })}
      />
    </ScrollView>
  );
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const fromDateInput = (v: string, endOfDay = false) => (v ? new Date(`${v}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString() : null);

function CouponSheet({ coupon, onClose }: { coupon: ShopCoupon | null; onClose: () => void }) {
  const save = useSaveCoupon();
  const toast = useToast();
  const [code, setCode] = useState(coupon?.code ?? '');
  const [description, setDescription] = useState(coupon?.description ?? '');
  const [type, setType] = useState<number>(coupon?.discountType ?? PERCENT);
  const [value, setValue] = useState(coupon ? String(coupon.value) : '');
  const [minOrder, setMinOrder] = useState(coupon?.minOrderAmount?.toString() ?? '');
  const [maxDiscount, setMaxDiscount] = useState(coupon?.maxDiscountAmount?.toString() ?? '');
  const [startsAt, setStartsAt] = useState(toDateInput(coupon?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toDateInput(coupon?.endsAt ?? null));
  const [usageLimit, setUsageLimit] = useState(coupon?.usageLimit?.toString() ?? '');
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);
  const [errors, setErrors] = useState<{ code?: string; value?: string; endsAt?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const submit = () => {
    const n = Number(value);
    const found = {
      code: !/^[A-Z0-9_-]{3,30}$/i.test(code.trim()) ? 'Use 3–30 letters, numbers, dashes or underscores.' : undefined,
      value: !(n > 0) ? 'Enter a value above zero.' : type === PERCENT && n > 90 ? 'Percentage discounts can be at most 90%.' : undefined,
      endsAt: startsAt && endsAt && endsAt < startsAt ? 'End date must be after the start date.' : undefined,
    };
    setErrors(found);
    setServerError(null);
    if (Object.values(found).some(Boolean)) return;
    const num = (s: string) => (s === '' ? null : Number(s));
    save.mutate({
      id: coupon?.id,
      body: {
        code: code.trim().toUpperCase(), description: description.trim() || null, discountType: type, value: n,
        minOrderAmount: num(minOrder), maxDiscountAmount: type === PERCENT ? num(maxDiscount) : null,
        startsAt: fromDateInput(startsAt), endsAt: fromDateInput(endsAt, true), usageLimit: num(usageLimit), isActive,
      },
    }, {
      onSuccess: () => { toast.show({ message: coupon ? 'Coupon saved' : 'Coupon created' }); onClose(); },
      onError: e => setServerError(apiErrorText(e)),
    });
  };

  return (
    <FormSheet visible onClose={onClose} title={coupon ? `Edit ${coupon.code}` : 'New coupon'}
      onSave={submit} saveLabel={coupon ? 'Save coupon' : 'Create coupon'} saving={save.isPending} error={serverError}>
      <Field label="Code" value={code} onChangeText={t => { setCode(t.toUpperCase().replace(/\s/g, '')); setErrors(e => ({ ...e, code: undefined })); }}
        autoCapitalize="characters" autoCorrect={false} placeholder="WELCOME10" error={errors.code} />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} placeholder="10% off your first order" />
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Discount type</Text>
      <ChipRow<string> label="Discount type" value={String(type)} onChange={k => setType(Number(k))} style={{ marginBottom: SP.lg }}
        items={[{ key: String(PERCENT), label: 'Percentage', icon: 'percent' }, { key: String(FIXED), label: 'Fixed amount (₹)' }]} />
      <RowGrid>
        <GridCell>
          <Field label={type === PERCENT ? 'Percent off' : 'Amount off (₹)'} value={value} onChangeText={t => { setValue(decimalOnly(t)); setErrors(e => ({ ...e, value: undefined })); }}
            keyboardType="decimal-pad" error={errors.value} />
        </GridCell>
        <GridCell>
          <Field label="Min order (₹)" value={minOrder} onChangeText={t => setMinOrder(decimalOnly(t))} keyboardType="decimal-pad" placeholder="None" />
        </GridCell>
      </RowGrid>
      {type === PERCENT && (
        <>
          <Field label="Maximum discount (₹, optional)" value={maxDiscount} onChangeText={t => setMaxDiscount(decimalOnly(t))} keyboardType="decimal-pad" placeholder="No cap" />
        </>
      )}
      <DateWithClear label="Starts (optional)" value={startsAt} onChange={setStartsAt} />
      <DateWithClear label="Ends (optional)" value={endsAt} onChange={v => { setEndsAt(v); setErrors(e => ({ ...e, endsAt: undefined })); }} error={errors.endsAt} />
      <Field label="Usage limit (optional)" value={usageLimit} onChangeText={t => setUsageLimit(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Unlimited" />
      <Text style={{ color: T.textFaint, fontSize: 12, marginTop: -8, marginBottom: SP.md }}>Total redemptions across all members.</Text>
      <SwitchRow label="Active" value={isActive} onValueChange={setIsActive} />
    </FormSheet>
  );
}

function DateWithClear({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const year = new Date().getFullYear();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.sm }}>
      <View style={{ flex: 1 }}>
        <DateField label={label} value={value} onChange={onChange} placeholder="Any time" minYear={year - 1} maxYear={year + 5} error={error} />
      </View>
      {!!value && <View style={{ marginTop: 26 }}><IconButton icon="x" label={`Clear ${label}`} onPress={() => onChange('')} /></View>}
    </View>
  );
}
