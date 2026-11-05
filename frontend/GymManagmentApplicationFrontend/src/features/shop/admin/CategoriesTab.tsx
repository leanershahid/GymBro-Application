import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import UploadField from '../../common/components/UploadField';
import { useToast } from '../../common/components/Toast';
import EmptyState from '../../common/components/EmptyState';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { useApiAccess } from '../../access/context/AccessContext';
import { apiErrorText } from '../../../api/apiError';
import { useAdminCategories, useDeleteCategory, useSaveCategory } from '../api/adminQueries';
import { ShopCategory } from '../api/shop.types';
import {
  ConfirmSheet, ErrorView, FormSheet, IconButton, PickerField, RowCard, SmallButton, Thumb, orderCategories,
} from './components/kit';

export default function CategoriesTab() {
  const { canCreate, canEdit, canDelete } = useApiAccess('shop');
  const toast = useToast();
  const { data, isPending, isError, error, refetch, isRefetching } = useAdminCategories();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<ShopCategory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ShopCategory | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const ordered = orderCategories(data ?? []);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={T.brand} colors={[T.brand]} />}
    >
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: SP.md }}>How the shop is organised in menus and filters.</Text>
      {canCreate && <SmallButton label="New category" icon="plus" variant="brand" onPress={() => setEditing('new')} style={{ alignSelf: 'flex-start', marginBottom: SP.lg }} />}

      {isPending ? <Skeleton rows={5} height={72} />
        : isError ? <ErrorView error={error} onRetry={refetch} />
        : !ordered.length ? (
          <EmptyState icon="folder" title="No categories yet" action={canCreate ? { label: 'Create one', onPress: () => setEditing('new') } : undefined} />
        ) : ordered.map(c => {
          const child = !!c.parentId;
          return (
            <RowCard key={c.id} onPress={canEdit ? () => setEditing(c) : undefined} label={`Edit ${c.name}`} style={child ? { marginLeft: SP.xl } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
                {child && <Feather name="corner-down-right" size={14} color={T.textFaint} />}
                <Thumb uri={c.imageUrl} size={44} icon="folder" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{c.name}</Text>
                  <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12 }}>/{c.slug} · {c.productCount} product{c.productCount === 1 ? '' : 's'}</Text>
                  <View style={{ marginTop: 4 }}>
                    <StatusPill label={c.isActive === false ? 'Hidden' : 'Visible'} tone={c.isActive === false ? 'neutral' : 'ok'} />
                  </View>
                </View>
                {canDelete && <IconButton icon="trash-2" label={`Delete ${c.name}`} tone={T.err} onPress={() => setDeleting(c)} />}
              </View>
            </RowCard>
          );
        })}

      {editing !== null && (
        <CategorySheet key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} all={data ?? []} onClose={() => setEditing(null)} />
      )}
      <ConfirmSheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'category'}?`}
        message="Categories that still contain products or sub-categories can't be deleted. Move or delete those first."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => { toast.show({ message: `${deleting.name} deleted` }); setDeleting(null); },
          onError: e => { setDeleting(null); setBlocked(apiErrorText(e)); },
        })}
      />
      <ConfirmSheet
        visible={!!blocked}
        onClose={() => setBlocked(null)}
        onConfirm={() => setBlocked(null)}
        title="Can't delete this category"
        message={blocked ?? ''}
        confirmLabel="OK"
        danger={false}
      />
    </ScrollView>
  );
}

function CategorySheet({ category, all, onClose }: { category: ShopCategory | null; all: ShopCategory[]; onClose: () => void }) {
  const save = useSaveCategory();
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [parentId, setParentId] = useState<number | null>(category?.parentId ?? null);
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? all.filter(c => !c.parentId).length + 1));
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [nameError, setNameError] = useState<string>();
  const [serverError, setServerError] = useState<string | null>(null);
  const hasChildren = !!category && all.some(c => c.parentId === category.id);

  // Only top-level categories can be parents (two levels deep at most).
  const parents = all.filter(c => !c.parentId && c.id !== category?.id).sort((a, b) => a.sortOrder - b.sortOrder);

  const submit = () => {
    if (name.trim().length < 2) { setNameError('Enter a category name.'); return; }
    setServerError(null);
    save.mutate({
      id: category?.id,
      body: {
        name: name.trim(), slug: slug.trim() || null, description: description.trim() || null, imageUrl: imageUrl || null,
        parentId, sortOrder: Number(sortOrder) || 0, isActive,
      },
    }, {
      onSuccess: () => { toast.show({ message: category ? 'Category saved' : 'Category created' }); onClose(); },
      onError: e => setServerError(apiErrorText(e)),
    });
  };

  return (
    <FormSheet visible onClose={onClose} title={category ? `Edit ${category.name}` : 'New category'}
      onSave={submit} saveLabel={category ? 'Save' : 'Create'} saving={save.isPending} error={serverError}>
      <Field label="Name" value={name} onChangeText={t => { setName(t); setNameError(undefined); }} error={nameError} />
      <Field label="URL slug (optional)" value={slug} onChangeText={setSlug} autoCapitalize="none" autoCorrect={false} placeholder="Generated from the name" />
      {hasChildren ? (
        <Text style={{ color: T.textFaint, fontSize: 12, marginBottom: SP.lg }}>This category has sub-categories, so it stays top level.</Text>
      ) : (
        <PickerField label="Parent category" value={parentId} onChange={setParentId}
          options={[{ value: null, label: 'None (top level)' }, ...parents.map(p => ({ value: p.id as number | null, label: p.name }))]} />
      )}
      <Field label="Sort order" value={sortOrder} onChangeText={t => setSortOrder(t.replace(/[^0-9-]/g, ''))} keyboardType="number-pad" />
      <UploadField label="Image" value={imageUrl} onChange={setImageUrl} folder="media" hint="Shown in the menu and category banner." />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline />
      <SwitchRow label="Visible in shop" value={isActive} onValueChange={setIsActive} />
    </FormSheet>
  );
}
