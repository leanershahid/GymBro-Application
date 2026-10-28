import React from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { T, SP, R, withAlpha, Shadow } from '../../../theme';
import { useMe } from '../../auth/api/authQueries';

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
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

interface Props {
  onBack: () => void;
  roleLabel: string;
}

/** Full-page view of everything known about the signed-in admin/staff user. */
export default function AdminProfileDetailsPage({ onBack, roleLabel }: Props) {
  const { data: profile, isLoading, isError, refetch } = useMe();
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';

  return (
    <Screen>
      <ScreenHeader title="Profile details" eyebrow="Account" onBack={onBack} />

      {isLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={T.brand} />
        </View>
      )}

      {!isLoading && isError && (
        <EmptyState
          icon="alert-triangle"
          tone="error"
          title="Couldn't load your profile"
          subtitle="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      )}

      {!isLoading && !isError && profile && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: avatar + name + role */}
          <View style={{ alignItems: 'center', marginVertical: SP.lg }}>
            {profile.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={[{ width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: T.brand }, Shadow.neon]}
              />
            ) : (
              <View style={[{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: withAlpha(T.brand, 0.4),
              }, Shadow.neon]}>
                <Text style={{ color: T.onBrand, fontSize: 32, fontWeight: '800' }}>
                  {getInitials(fullName || profile.email)}
                </Text>
              </View>
            )}

            <Text style={{ color: T.text, fontSize: 21, fontWeight: '800', marginTop: SP.md, letterSpacing: -0.3 }}>
              {fullName || 'Unnamed user'}
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
              backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder,
              borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4,
            }}>
              <Feather name="shield" size={11} color={T.brand} />
              <Text style={{ color: T.brand, fontSize: 11, fontWeight: '700' }}>{roleLabel}</Text>
            </View>
          </View>

          {/* Contact */}
          <Section title="Contact">
            <DetailRow icon="mail" label="Email" value={profile.email} />
            <Divider />
            <DetailRow icon="phone" label="Phone" value={profile.phone || 'Not set'} />
          </Section>

          {/* Account */}
          <Section title="Account">
            <DetailRow
              icon={profile.isEmailVerified ? 'check-circle' : 'alert-circle'}
              label="Email status"
              value={profile.isEmailVerified ? 'Verified' : 'Not verified'}
            />
            <Divider />
            <DetailRow icon="shield" label="Role" value={roleLabel} />
          </Section>
        </ScrollView>
      )}
    </Screen>
  );
}
