import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha, Shadow } from '../../../theme';
import { useTrainer } from '../api/trainerQueries';
import { TrainerSummary } from '../types/trainer.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import StatusPill from '../../common/components/StatusPill';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import AccessPanel from '../../module-access/components/AccessPanel';

type Tab = 'details' | 'access';

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
      paddingHorizontal: SP.lg, marginBottom: SP.lg,
    }}>
      <Text style={{
        color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase',
        paddingTop: SP.md, paddingBottom: 4,
      }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: T.lineSubtle }} />;
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md }}>
      <View style={{
        width: 40, height: 40, borderRadius: R.md,
        backgroundColor: T.bgInputActive, alignItems: 'center', justifyContent: 'center',
        marginRight: SP.md,
      }}>
        <Feather name={icon} size={17} color={T.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={{
      backgroundColor: withAlpha(T.text, 0.05), borderWidth: 1, borderColor: withAlpha(T.text, 0.10),
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    }}>
      <Text style={{ color: T.textSub, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

interface Props {
  trainer: TrainerSummary;
  onBack: () => void;
  /** When provided, an Edit action is shown in the header. */
  onEdit?: () => void;
}

export default function TrainerDetailPage({ trainer: summary, onBack, onEdit }: Props) {
  const [tab, setTab] = useState<Tab>('details');
  const { data: trainer, isLoading, isError, refetch } = useTrainer(summary.id);

  const t = trainer ?? summary; // show list data instantly, swap in full detail once loaded
  const fullName = t.displayName;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Trainer"
        title={fullName}
        onBack={onBack}
        action={onEdit ? { label: 'Edit', icon: 'edit-2', onPress: onEdit } : undefined}
      />

      <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.md }}>
        <SegmentedTabs<Tab>
          tabs={[{ key: 'details', label: 'Details' }, { key: 'access', label: 'Access' }]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'access' && <AccessPanel userId={summary.userId} intro={`Choose which feature areas ${fullName} can see and use.`} />}

      {tab === 'details' && (
        <>
          {isLoading && !trainer && <LoadingState label="Loading trainer" />}

          {isError && !trainer && (
            <EmptyState
              icon="alert-triangle"
              tone="error"
              title="Couldn't load full details"
              subtitle="Showing what's available. Pull to retry."
              action={{ label: 'Try again', onPress: () => refetch() }}
            />
          )}

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={{ alignItems: 'center', marginVertical: SP.lg }}>
              <View style={[{
                width: 92, height: 92, borderRadius: 46,
                backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: withAlpha(T.brand, 0.4),
              }, Shadow.neon]}>
                <Text style={{ color: T.onBrand, fontSize: 30, fontWeight: '800' }}>
                  {getInitials(fullName)}
                </Text>
              </View>

              <Text style={{ color: T.text, fontSize: 21, fontWeight: '800', marginTop: SP.md, letterSpacing: -0.3 }}>
                {fullName}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <StatusPill label={t.isAvailable ? 'Available' : 'Unavailable'} tone={t.isAvailable ? 'ok' : 'err'} dot />
                {!!t.trainerCode && <StatusPill label={t.trainerCode} tone="neutral" />}
              </View>
            </View>

            {/* Contact */}
            <Section title="Contact">
              <DetailRow icon="mail" label="Email" value={t.email} />
              <Divider />
              <DetailRow icon="phone" label="Phone" value={t.phone || 'Not set'} />
              {!!t.address && (<><Divider /><DetailRow icon="map-pin" label="Address" value={t.address} /></>)}
            </Section>

            {/* Employment */}
            {(t.employment?.designation || t.employment?.department || t.employment?.employmentType) && (
              <Section title="Employment">
                {!!t.employment?.designation && <DetailRow icon="briefcase" label="Designation" value={t.employment.designation} />}
                {!!t.employment?.department && (<><Divider /><DetailRow icon="grid" label="Department" value={t.employment.department} /></>)}
                {!!t.employment?.employmentType && (<><Divider /><DetailRow icon="file-text" label="Employment type" value={t.employment.employmentType} /></>)}
                {!!t.employment?.joiningDate && (<><Divider /><DetailRow icon="calendar" label="Joined" value={t.employment.joiningDate} /></>)}
              </Section>
            )}

            {/* Experience & rating */}
            <Section title="Experience">
              <DetailRow
                icon="award"
                label="Years of experience"
                value={t.experienceYears != null ? `${t.experienceYears} yr${t.experienceYears !== 1 ? 's' : ''}` : 'Not set'}
              />
              <Divider />
              <DetailRow icon="star" label="Rating" value={t.rating != null ? t.rating.toFixed(1) : 'No ratings yet'} />
            </Section>

            {/* Specializations & languages */}
            {(!!t.specializations?.length || !!t.languagesKnown?.length) && (
              <Section title="Skills">
                {!!t.specializations?.length && (
                  <View style={{ paddingVertical: SP.md }}>
                    <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 }}>SPECIALIZATIONS</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {t.specializations.map((s) => <Chip key={s} label={s} />)}
                    </View>
                  </View>
                )}
                {!!t.specializations?.length && !!t.languagesKnown?.length && <Divider />}
                {!!t.languagesKnown?.length && (
                  <View style={{ paddingVertical: SP.md }}>
                    <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 }}>LANGUAGES</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {t.languagesKnown.map((l) => <Chip key={l} label={l} />)}
                    </View>
                  </View>
                )}
              </Section>
            )}

            {/* Bio */}
            {!!t.bio && (
              <Section title="About">
                <Text style={{ color: T.text, fontSize: 14, lineHeight: 21, paddingVertical: SP.md }}>{t.bio}</Text>
              </Section>
            )}

            {/* Notes (admin-only) */}
            {!!t.notes && (
              <Section title="Internal notes">
                <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 20, paddingVertical: SP.md }}>{t.notes}</Text>
              </Section>
            )}
          </ScrollView>
        </>
      )}
    </Screen>
  );
}
