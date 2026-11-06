import React from 'react';
import { ScrollView, View, Text, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import LoadingState from '../../common/components/LoadingState';
import PrimaryButton from '../../common/components/PrimaryButton';
import { apiErrorText } from '../../../api/apiError';
import { useAnnouncement } from '../api/operationsQueries';
import { RichText } from '../components/OperationsUi';

interface Props {
  announcementId: number;
  onBack: () => void;
  /**
   * Opens the button's app route (e.g. "book", "shop", "challenges"). The area decides what a
   * route means; leave undefined to hide the button.
   */
  onOpenRoute?: (route: string) => void;
}

/** One announcement, full text. Opening it marks it read. */
export default function AnnouncementDetailScreen({ announcementId, onBack, onOpenRoute }: Props) {
  const { data: a, isLoading, isError, error, refetch } = useAnnouncement(announcementId);

  return (
    <Screen>
      <ScreenHeader eyebrow="Announcement" title={a?.title ?? 'Announcement'} onBack={onBack} />
      {isLoading ? (
        <LoadingState label="Loading announcement" />
      ) : isError || !a ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't open this announcement" subtitle={apiErrorText(error)}
          action={{ label: 'Try again', onPress: () => refetch() }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.lg }}>
          {a.imageUrl && (
            <Image source={{ uri: a.imageUrl }} accessibilityIgnoresInvertColors
              style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: R.lg, backgroundColor: T.bgInput }} />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm, flexWrap: 'wrap' }}>
            {a.isUrgent && <Tag icon="alert-circle" label="Urgent" color={T.err} />}
            {a.isPinned && <Tag icon="bookmark" label="Pinned" color={T.brandGold} />}
            <Text style={{ color: T.textFaint, fontSize: 13 }}>
              {new Date(a.publishedAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32 }}>{a.title}</Text>
          <RichText text={a.body} size={15} />
          {a.ctaLabel && a.ctaRoute && onOpenRoute && (
            <PrimaryButton label={a.ctaLabel} icon="arrow-right" onPress={() => onOpenRoute(a.ctaRoute!)} style={{ marginTop: SP.sm }} />
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function Tag({ icon, label, color }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Feather name={icon} size={13} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}
