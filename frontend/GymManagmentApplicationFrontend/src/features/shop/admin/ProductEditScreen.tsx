import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { T, SP, R } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill from '../../common/components/StatusPill';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import { Field, SwitchRow, RowGrid, GridCell } from '../../common/components/FormFields';
import { useApiAccess } from '../../access/context/AccessContext';
import { apiErrorText } from '../../../api/apiError';
import { PickedFile } from '../../../api/upload';
import { shopAdminApi } from '../api/adminApi';
import {
  shopAdminKeys, useAdminCategories, useAdminProduct, useDeleteProductImage, useDeleteVariant, useSaveProduct, useSaveVariant,
  useUpdateProductImage, useUploadProductImage,
} from '../api/adminQueries';
import { ShopAdminProduct, ShopAdminVariant, ShopProductInput, ShopVariantInput } from '../api/shop.types';
import { formatPrice } from '../common/format';
import {
  Card, ConfirmSheet, ErrorView, FormSheet, IconButton, PickerField, SmallButton, decimalOnly, orderCategories,
} from './components/kit';
import { ShopNav } from './nav';

const SPEC_SUGGESTIONS = ['Serving size', 'Servings', 'Protein per serving', 'Material', 'Weight', 'Warranty'];
const SHORT_MAX = 300;

interface Props { productId: number | null; nav: ShopNav; onBack: () => void; onCreated: (id: number) => void }

export default function ProductEditScreen({ productId, onBack, onCreated }: Props) {
  const { data: product, isPending, isError, error, refetch } = useAdminProduct(productId);
  const isNew = productId === null;

  return (
    <Screen>
      <ScreenHeader eyebrow={isNew ? 'Products' : 'Edit product'} title={isNew ? 'New product' : product?.name ?? 'Product'} onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 80 }}>
          {isNew ? (
            <>
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.lg }}>
                Add details and photos. Variants and stock can be set right after creating it.
              </Text>
              <DetailsForm onCreated={onCreated} />
            </>
          ) : isPending ? <Skeleton rows={3} height={220} />
            : isError || !product ? <ErrorView error={error} onRetry={refetch} />
            : (
              <>
                <DetailsForm key={product.id} product={product} />
                <ImagesCard product={product} />
                <VariantsCard product={product} />
              </>
            )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ── Details ─────────────────────────────────────────────────────────────

interface Form {
  name: string; sku: string; slug: string; brand: string; categoryId: number | null;
  shortDescription: string; description: string; basePrice: string; compareAtPrice: string;
  isActive: boolean; isFeatured: boolean; isNew: boolean; specs: { key: string; value: string }[];
}
type Errors = Partial<Record<keyof Form, string>>;

const blank: Form = {
  name: '', sku: '', slug: '', brand: '', categoryId: null, shortDescription: '', description: '', basePrice: '', compareAtPrice: '',
  isActive: true, isFeatured: false, isNew: true, specs: [{ key: 'Serving size', value: '' }],
};

const toForm = (p: ShopAdminProduct): Form => ({
  name: p.name, sku: p.sku, slug: p.slug, brand: p.brand ?? '', categoryId: p.categoryId,
  shortDescription: p.shortDescription ?? '', description: p.description ?? '',
  basePrice: String(p.basePrice), compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : '',
  isActive: p.isActive, isFeatured: p.isFeatured, isNew: p.isNew,
  specs: Object.entries(p.specifications ?? {}).map(([key, value]) => ({ key, value })),
});

function DetailsForm({ product, onCreated }: { product?: ShopAdminProduct; onCreated?: (id: number) => void }) {
  const { canEdit, canCreate } = useApiAccess('shop');
  const editable = product ? canEdit : canCreate;
  const categories = useAdminCategories();
  const save = useSaveProduct();
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState<Form>(product ? toForm(product) : blank);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState<PickedFile[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, value: Form[K]) => {
    setV(s => ({ ...s, [k]: value }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const submit = () => {
    const price = Number(v.basePrice);
    const compare = v.compareAtPrice === '' ? null : Number(v.compareAtPrice);
    const found: Errors = {
      name: v.name.trim().length < 2 ? 'Enter a product name.' : undefined,
      sku: !v.sku.trim() ? 'Enter a SKU.' : undefined,
      basePrice: !(price > 0) ? 'Enter a price above zero.' : undefined,
      compareAtPrice: compare !== null && !(compare > price) ? 'The original price must be higher than the selling price.' : undefined,
      categoryId: !v.categoryId ? 'Choose a category.' : undefined,
    };
    setErrors(found);
    setServerError(null);
    if (Object.values(found).some(Boolean)) return;
    const body: ShopProductInput = {
      name: v.name.trim(),
      slug: v.slug.trim() || null,
      sku: v.sku.trim().toUpperCase(),
      shortDescription: v.shortDescription.trim() || null,
      description: v.description.trim() || null,
      brand: v.brand.trim() || null,
      basePrice: price,
      compareAtPrice: compare,
      categoryId: v.categoryId!,
      isActive: v.isActive, isFeatured: v.isFeatured, isNew: v.isNew,
      specifications: Object.fromEntries(v.specs.filter(s => s.key.trim() && s.value.trim()).map(s => [s.key.trim(), s.value.trim()])),
    };
    save.mutate({ id: product?.id, body }, {
      onSuccess: async p => {
        if (product) { toast.show({ message: 'Product saved' }); return; }
        // Upload the photos picked on the New product screen, one by one, then open the product for variants.
        let failed = 0;
        for (const [i, file] of pending.entries()) {
          setProgress(`Uploading image ${i + 1} of ${pending.length}…`);
          try {
            const updated = await shopAdminApi.uploadImage(p.id, file, p.name, i === 0);
            qc.setQueryData(shopAdminKeys.product(p.id), updated);
          } catch (e) {
            failed += 1;
            toast.show({ type: 'error', message: `Image ${i + 1} didn't upload: ${apiErrorText(e)}` });
          }
        }
        setProgress(null);
        toast.show({ message: pending.length && !failed ? `Product created · ${pending.length} image${pending.length === 1 ? '' : 's'} uploaded` : 'Product created' });
        await qc.invalidateQueries({ queryKey: shopAdminKeys.all });
        onCreated?.(p.id);
      },
      onError: e => setServerError(apiErrorText(e)),
    });
  };

  const categoryOptions = orderCategories(categories.data ?? []).map(c => ({
    value: c.id as number | null, label: c.isActive === false ? `${c.name} (hidden)` : c.name, indent: !!c.parentId,
  }));
  const nextSuggestion = SPEC_SUGGESTIONS.find(s => !v.specs.some(x => x.key === s)) ?? '';

  return (
    <>
      <Card title="Details">
        <Field label="Name" value={v.name} onChangeText={t => set('name', t)} error={errors.name} editable={editable} />
        <RowGrid>
          <GridCell><Field label="SKU" value={v.sku} onChangeText={t => set('sku', t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} error={errors.sku} editable={editable} /></GridCell>
          <GridCell><Field label="Brand (optional)" value={v.brand} onChangeText={t => set('brand', t)} editable={editable} /></GridCell>
        </RowGrid>
        <Field label="URL slug (optional)" value={v.slug} onChangeText={t => set('slug', t)} autoCapitalize="none" autoCorrect={false}
          placeholder="Generated from the name when empty" editable={editable} />
        <PickerField label="Category" value={v.categoryId} options={categoryOptions} onChange={c => set('categoryId', c)} placeholder="Choose category" error={errors.categoryId} />
        <Field label={`Short description (${v.shortDescription.length}/${SHORT_MAX})`} value={v.shortDescription}
          onChangeText={t => set('shortDescription', t.slice(0, SHORT_MAX))} multiline editable={editable} />
        <LongText label="Full description (optional)" value={v.description} onChangeText={t => set('description', t)} editable={editable} />
      </Card>

      {!product && <NewImagesPicker files={pending} onChange={setPending} progress={progress} />}

      <Card title="Specifications" subtitle="Shown as a table on the product page."
        right={editable ? <SmallButton label="Add row" icon="plus" onPress={() => set('specs', [...v.specs, { key: nextSuggestion, value: '' }])} /> : undefined}>
        {v.specs.length === 0 && <Text style={{ color: T.textFaint, fontSize: 13 }}>No specifications yet.</Text>}
        {v.specs.map((row, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm }}>
            <SpecInput value={row.key} placeholder="Name" label={`Specification ${i + 1} name`} flex={1} editable={editable}
              onChangeText={t => set('specs', v.specs.map((s, j) => (j === i ? { ...s, key: t } : s)))} />
            <SpecInput value={row.value} placeholder="e.g. 30 g" label={`Specification ${i + 1} value`} flex={1.3} editable={editable}
              onChangeText={t => set('specs', v.specs.map((s, j) => (j === i ? { ...s, value: t } : s)))} />
            {editable && <IconButton icon="x" label={`Remove ${row.key || 'row'}`} onPress={() => set('specs', v.specs.filter((_, j) => j !== i))} />}
          </View>
        ))}
        {editable && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SP.xs }}>
            {SPEC_SUGGESTIONS.filter(s => !v.specs.some(x => x.key === s)).map(s => (
              <SmallButton key={s} label={`+ ${s}`} onPress={() => set('specs', [...v.specs, { key: s, value: '' }])} style={{ paddingHorizontal: 12 }} />
            ))}
          </View>
        )}
      </Card>

      <Card title="Pricing">
        <Field label="Selling price (₹)" value={v.basePrice} onChangeText={t => set('basePrice', decimalOnly(t))} keyboardType="decimal-pad" error={errors.basePrice} editable={editable} />
        <Field label="Original price (₹, optional)" value={v.compareAtPrice} onChangeText={t => set('compareAtPrice', decimalOnly(t))} keyboardType="decimal-pad"
          error={errors.compareAtPrice} editable={editable} placeholder="Shown struck through" />
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: -8 }}>Variants carry their own price; this is used when a variant has none.</Text>
      </Card>

      <Card title="Visibility" style={{ paddingBottom: 0 }}>
        <SwitchRow label="Visible in store" value={v.isActive} onValueChange={x => editable && set('isActive', x)} />
        <SwitchRow label="Featured" description="Shown in bestsellers" value={v.isFeatured} onValueChange={x => editable && set('isFeatured', x)} />
        <SwitchRow label="Mark as new" value={v.isNew} onValueChange={x => editable && set('isNew', x)} />
      </Card>

      {!!serverError && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 13, marginBottom: SP.md }}>{serverError}</Text>}
      {!!progress && <Text accessibilityLiveRegion="polite" style={{ color: T.brand, fontSize: 13, marginBottom: SP.md }}>{progress}</Text>}
      {editable && (
        <PrimaryButton
          label={product ? 'Save changes' : pending.length ? `Create product and upload ${pending.length} image${pending.length === 1 ? '' : 's'}` : 'Create product'}
          onPress={submit}
          loading={save.isPending || progress !== null}
          style={{ marginBottom: SP.xl }}
        />
      )}
    </>
  );
}

function SpecInput({ value, onChangeText, placeholder, label, flex, editable }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; label: string; flex: number; editable: boolean;
}) {
  return (
    <TextInput
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={T.textFaint}
      accessibilityLabel={label} editable={editable}
      style={{ flex, minWidth: 0, height: 44, borderRadius: 10, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, color: T.text, paddingHorizontal: 12, fontSize: 14 }}
    />
  );
}

function LongText({ label, value, onChangeText, editable }: { label: string; value: string; onChangeText: (t: string) => void; editable: boolean }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} multiline textAlignVertical="top" accessibilityLabel={label} editable={editable}
        style={{ minHeight: 140, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.bgInput, color: T.text, padding: 14, fontSize: 15 }}
      />
    </View>
  );
}

// ── Images ──────────────────────────────────────────────────────────────

async function pickImages(multiple: boolean): Promise<PickedFile[]> {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Allow photo access to upload images.');
  }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, quality: 0.85 });
  if (res.canceled) return [];
  return res.assets.map(a => ({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName }));
}

function Tile({ uri, badge, children, size }: { uri: string; badge?: string; children?: React.ReactNode; size: number }) {
  return (
    <View style={{ width: size, borderRadius: R.md, overflow: 'hidden', borderWidth: 1, borderColor: T.line, backgroundColor: T.bg }}>
      <Image source={{ uri }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      {badge && (
        <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: T.brand, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: T.onBrand, fontSize: 11, fontWeight: '800' }}>{badge}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>{children}</View>
    </View>
  );
}

function useTileSize() {
  const [w, setW] = useState(0);
  // Two per row on phones, more on wider screens; never below 132 so four 44px buttons fit… in two rows if needed.
  const cols = w > 600 ? 4 : w > 420 ? 3 : 2;
  const size = w ? Math.floor((w - SP.sm * (cols - 1)) / cols) : 0;
  return { size, onLayout: (e: { nativeEvent: { layout: { width: number } } }) => setW(e.nativeEvent.layout.width) };
}

function NewImagesPicker({ files, onChange, progress }: { files: PickedFile[]; onChange: (f: PickedFile[]) => void; progress: string | null }) {
  const [problem, setProblem] = useState<string | null>(null);
  const { size, onLayout } = useTileSize();
  const add = async () => {
    setProblem(null);
    try { const picked = await pickImages(true); if (picked.length) onChange([...files, ...picked]); }
    catch (e) { setProblem(e instanceof Error ? e.message : 'Could not open photos.'); }
  };
  return (
    <Card title="Images" subtitle="The first image is the main one. They upload when you create the product."
      right={<SmallButton label="Choose" icon="upload" onPress={add} disabled={!!progress} />}>
      <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
        {files.length === 0 ? (
          <EmptyDrop onPress={add} />
        ) : size > 0 && files.map((f, i) => (
          <Tile key={`${f.uri}-${i}`} uri={f.uri} badge={i === 0 ? 'Main' : undefined} size={size}>
            <IconButton icon="star" label="Make main image" disabled={i === 0} onPress={() => onChange([f, ...files.filter((_, j) => j !== i)])} />
            <IconButton icon="trash-2" label={`Remove image ${i + 1}`} tone={T.err} onPress={() => onChange(files.filter((_, j) => j !== i))} />
          </Tile>
        ))}
      </View>
      {!!problem && <Text style={{ color: T.brandGold, fontSize: 12, marginTop: SP.sm }}>{problem}</Text>}
      {!!progress && <Text style={{ color: T.brand, fontSize: 13, marginTop: SP.sm }}>{progress}</Text>}
    </Card>
  );
}

function EmptyDrop({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ width: '100%' }}>
      <SmallButton label="Choose product photos" icon="image" onPress={onPress}
        style={{ minHeight: 120, borderStyle: 'dashed', borderRadius: R.lg, width: '100%' }} />
    </View>
  );
}

function ImagesCard({ product }: { product: ShopAdminProduct }) {
  const { canEdit } = useApiAccess('shop');
  const toast = useToast();
  const upload = useUploadProductImage(product.id);
  const update = useUpdateProductImage(product.id);
  const remove = useDeleteProductImage(product.id);
  const [progress, setProgress] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { size, onLayout } = useTileSize();
  const images = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const fail = (e: unknown) => toast.show({ type: 'error', message: apiErrorText(e) });

  const add = async () => {
    let files: PickedFile[] = [];
    try { files = await pickImages(true); } catch (e) { fail(e); return; }
    let hasPrimary = images.some(i => i.isPrimary);
    for (const [i, file] of files.entries()) {
      setProgress(`Uploading image ${i + 1} of ${files.length}…`);
      try {
        await upload.mutateAsync({ file, altText: product.name, isPrimary: !hasPrimary });
        hasPrimary = true;
      } catch (e) { fail(e); break; }
    }
    setProgress(null);
  };

  // Swap sort orders with the neighbour so the move is visible even when orders have gaps.
  const move = (index: number, dir: -1 | 1) => {
    const a = images[index], b = images[index + dir];
    if (!a || !b) return;
    const target = b.sortOrder === a.sortOrder ? a.sortOrder + dir : b.sortOrder;
    update.mutate({ imageId: a.id, body: { altText: a.altText, sortOrder: target, isPrimary: a.isPrimary } }, { onError: fail });
  };

  return (
    <Card title="Images" subtitle="JPG, PNG or WebP. The primary image is shown first."
      right={canEdit ? <SmallButton label="Upload" icon="upload" onPress={add} loading={!!progress} /> : undefined}>
      {!!progress && <Text accessibilityLiveRegion="polite" style={{ color: T.brand, fontSize: 13, marginBottom: SP.sm }}>{progress}</Text>}
      <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
        {images.length === 0 ? (
          canEdit ? <EmptyDrop onPress={add} /> : <Text style={{ color: T.textFaint }}>No images yet.</Text>
        ) : size > 0 && images.map((img, i) => (
          <Tile key={img.id} uri={img.url} badge={img.isPrimary ? 'Primary' : undefined} size={size}>
            {canEdit && (
              <>
                <IconButton icon="chevron-left" label="Move earlier" disabled={i === 0 || update.isPending} onPress={() => move(i, -1)} />
                <IconButton icon="chevron-right" label="Move later" disabled={i === images.length - 1 || update.isPending} onPress={() => move(i, 1)} />
                <IconButton icon="star" label="Make primary image" disabled={img.isPrimary || update.isPending} tone={T.brandGold}
                  onPress={() => update.mutate({ imageId: img.id, body: { altText: img.altText, sortOrder: img.sortOrder, isPrimary: true } }, { onError: fail })} />
                <IconButton icon="trash-2" label={`Delete image ${i + 1}`} tone={T.err} onPress={() => setDeleting(img.id)} />
              </>
            )}
          </Tile>
        ))}
      </View>
      <ConfirmSheet
        visible={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this image?"
        message="It is removed from the product straight away."
        confirmLabel="Delete image"
        loading={remove.isPending}
        onConfirm={() => deleting !== null && remove.mutate(deleting, { onSettled: () => setDeleting(null), onError: fail })}
      />
    </Card>
  );
}

// ── Variants ────────────────────────────────────────────────────────────

function VariantsCard({ product }: { product: ShopAdminProduct }) {
  const { canEdit, canDelete } = useApiAccess('shop');
  const toast = useToast();
  const [editing, setEditing] = useState<ShopAdminVariant | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ShopAdminVariant | null>(null);
  const remove = useDeleteVariant(product.id);
  const only = product.variants.length <= 1;

  return (
    <Card title="Variants" subtitle="Flavours, sizes or colours, each with its own SKU, price and stock."
      right={canEdit ? <SmallButton label="Add" icon="plus" onPress={() => setEditing('new')} /> : undefined}>
      {product.variants.length === 0 && <Text style={{ color: T.textFaint, fontSize: 13 }}>No variants yet. Add one so members can buy this product.</Text>}
      {product.variants.map((v, idx) => {
        const attrs = [v.flavour, v.size, v.colour, v.weight].filter(Boolean).join(' · ');
        const stockC = v.stock === 0 ? T.err : v.stock <= v.lowStockThreshold ? T.brandGold : T.textSub;
        return (
          <View key={v.id} style={{ flexDirection: 'row', gap: SP.sm, paddingVertical: SP.md, borderTopWidth: idx ? 1 : 0, borderTopColor: T.line }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{v.name}</Text>
                {v.isDefault && <StatusPill label="Default" tone="warn" />}
                <StatusPill label={v.isActive ? 'On sale' : 'Off'} tone={v.isActive ? 'ok' : 'neutral'} />
              </View>
              {!!attrs && <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, marginTop: 2 }}>{attrs}</Text>}
              <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>{v.sku}</Text>
              <View style={{ flexDirection: 'row', gap: SP.md, marginTop: 4, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>{formatPrice(v.price)}</Text>
                {!!v.compareAtPrice && <Text style={{ color: T.textFaint, fontSize: 12, textDecorationLine: 'line-through' }}>{formatPrice(v.compareAtPrice)}</Text>}
                <Text style={{ color: stockC, fontSize: 12, fontWeight: '700' }}>{v.stock} available</Text>
              </View>
            </View>
            {canEdit && <IconButton icon="edit-2" label={`Edit ${v.name}`} onPress={() => setEditing(v)} />}
            {canDelete && (
              <IconButton icon="trash-2" label={only ? `${v.name} is the only variant and can't be deleted` : `Delete ${v.name}`}
                tone={T.err} disabled={only} onPress={() => setDeleting(v)} />
            )}
          </View>
        );
      })}
      {only && product.variants.length === 1 && canDelete && (
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.xs }}>A product needs at least one variant, so the last one can't be deleted.</Text>
      )}

      {editing !== null && (
        <VariantSheet key={editing === 'new' ? 'new' : editing.id} productId={product.id} variant={editing === 'new' ? null : editing} visible
          isFirst={product.variants.length === 0} onClose={() => setEditing(null)} />
      )}
      <ConfirmSheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'variant'}?`}
        message="Members will no longer be able to buy this option."
        confirmLabel="Delete variant"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => toast.show({ message: `${deleting.name} deleted` }),
          onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
          onSettled: () => setDeleting(null),
        })}
      />
    </Card>
  );
}

interface VariantForm {
  name: string; sku: string; price: string; compareAtPrice: string; flavour: string; size: string; colour: string; weight: string;
  initialStock: string; lowStockThreshold: string; isDefault: boolean; isActive: boolean;
}

function VariantSheet({ productId, variant, visible, isFirst, onClose }: {
  productId: number; variant: ShopAdminVariant | null; visible: boolean; isFirst: boolean; onClose: () => void;
}) {
  const save = useSaveVariant(productId);
  const toast = useToast();
  const init = (): VariantForm => variant
    ? {
      name: variant.name, sku: variant.sku, price: String(variant.price), compareAtPrice: variant.compareAtPrice?.toString() ?? '',
      flavour: variant.flavour ?? '', size: variant.size ?? '', colour: variant.colour ?? '', weight: variant.weight ?? '',
      initialStock: '', lowStockThreshold: String(variant.lowStockThreshold), isDefault: variant.isDefault, isActive: variant.isActive,
    }
    : {
      name: '', sku: '', price: '', compareAtPrice: '', flavour: '', size: '', colour: '', weight: '',
      initialStock: '0', lowStockThreshold: '5', isDefault: isFirst, isActive: true,
    };
  const [v, setV] = useState<VariantForm>(init);
  const [errors, setErrors] = useState<Partial<Record<keyof VariantForm, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof VariantForm>(k: K, value: VariantForm[K]) => setV(s => ({ ...s, [k]: value }));

  const submit = () => {
    const price = Number(v.price);
    const found = {
      name: !v.name.trim() ? 'Enter the name members see, e.g. Chocolate 1 kg.' : undefined,
      sku: !v.sku.trim() ? 'Enter a SKU.' : undefined,
      price: !(price > 0) ? 'Enter a price above zero.' : undefined,
      compareAtPrice: v.compareAtPrice && !(Number(v.compareAtPrice) > price) ? 'Must be higher than the price.' : undefined,
    };
    setErrors(found);
    setServerError(null);
    if (Object.values(found).some(Boolean)) return;
    const body: ShopVariantInput = {
      name: v.name.trim(), sku: v.sku.trim().toUpperCase(), price,
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      flavour: v.flavour.trim() || null, size: v.size.trim() || null, colour: v.colour.trim() || null, weight: v.weight.trim() || null,
      isDefault: v.isDefault, isActive: v.isActive,
      initialStock: variant ? undefined : Number(v.initialStock || 0),
      lowStockThreshold: v.lowStockThreshold ? Number(v.lowStockThreshold) : undefined,
    };
    save.mutate({ variantId: variant?.id, body }, {
      onSuccess: () => { toast.show({ message: variant ? 'Variant saved' : 'Variant added' }); onClose(); },
      onError: e => setServerError(apiErrorText(e)),
    });
  };

  return (
    <FormSheet visible={visible} onClose={onClose} title={variant ? `Edit ${variant.name}` : 'New variant'}
      onSave={submit} saveLabel={variant ? 'Save variant' : 'Add variant'} saving={save.isPending} error={serverError}>
      <Field label="Name shown to members" value={v.name} onChangeText={t => set('name', t)} placeholder="Chocolate · 1 kg" error={errors.name} />
      <Field label="SKU" value={v.sku} onChangeText={t => set('sku', t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} error={errors.sku} />
      <RowGrid>
        <GridCell><Field label="Price (₹)" value={v.price} onChangeText={t => set('price', decimalOnly(t))} keyboardType="decimal-pad" error={errors.price} /></GridCell>
        <GridCell><Field label="Original (₹)" value={v.compareAtPrice} onChangeText={t => set('compareAtPrice', decimalOnly(t))} keyboardType="decimal-pad" error={errors.compareAtPrice} /></GridCell>
      </RowGrid>
      <RowGrid>
        <GridCell><Field label="Flavour" value={v.flavour} onChangeText={t => set('flavour', t)} placeholder="Chocolate" /></GridCell>
        <GridCell><Field label="Size" value={v.size} onChangeText={t => set('size', t)} placeholder="M" /></GridCell>
      </RowGrid>
      <RowGrid>
        <GridCell><Field label="Colour" value={v.colour} onChangeText={t => set('colour', t)} placeholder="Black" /></GridCell>
        <GridCell><Field label="Weight" value={v.weight} onChangeText={t => set('weight', t)} placeholder="1 kg" /></GridCell>
      </RowGrid>
      <RowGrid>
        {!variant && (
          <GridCell><Field label="Opening stock" value={v.initialStock} onChangeText={t => set('initialStock', t.replace(/\D/g, ''))} keyboardType="number-pad" /></GridCell>
        )}
        <GridCell><Field label="Low-stock alert at" value={v.lowStockThreshold} onChangeText={t => set('lowStockThreshold', t.replace(/\D/g, ''))} keyboardType="number-pad" /></GridCell>
      </RowGrid>
      {!variant && <Text style={{ color: T.textFaint, fontSize: 12, marginTop: -8, marginBottom: SP.md }}>Adjust stock later on the Inventory tab.</Text>}
      <SwitchRow label="Default variant" description="Shown first and used for the listed price." value={v.isDefault} onValueChange={x => set('isDefault', x)} />
      <SwitchRow label="Available for sale" value={v.isActive} onValueChange={x => set('isActive', x)} />
    </FormSheet>
  );
}
