import React from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { TenantPayload, TenantPlan } from '../types/tenant.types';
import { Field } from '../../trainers/components/FormFields';
import { T } from '../../trainers/components/theme';

export type TenantPlanErrors = {
  plan?: string;
  trialEndsAt?: string;
};

interface Props {
  data: Partial<TenantPayload>;
  onChange: (fields: Partial<TenantPayload>) => void;
  errors?: TenantPlanErrors;
}

const PLANS: { label: string; value: TenantPlan; description: string }[] = [
  { label: 'Starter',    value: TenantPlan.Starter,    description: 'Up to 2 branches, 100 members' },
  { label: 'Basic',      value: TenantPlan.Basic,       description: 'Up to 5 branches, 500 members' },
  { label: 'Pro',        value: TenantPlan.Pro,         description: 'Up to 20 branches, unlimited members' },
  { label: 'Enterprise', value: TenantPlan.Enterprise,  description: 'Unlimited everything + SLA' },
];

function Section({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#AAAAAA', marginBottom: 12, marginTop: 4 }}>
      {title}
    </Text>
  );
}

export default function StepTenantPlan({ data, onChange, errors = {} }: Props) {
  const selectedPlan = data.plan ?? TenantPlan.Starter;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 }}>
        Plan
      </Text>
      <Text style={{ fontSize: 14, color: '#AAAAAA', lineHeight: 20, marginBottom: 28 }}>
        Subscription plan and trial period
      </Text>

      <Section title="Subscription" />
      <View style={{ gap: 10, marginBottom: 20 }}>
        {PLANS.map((p) => {
          const isSelected = selectedPlan === p.value;
          return (
            <TouchableOpacity
              key={p.value}
              onPress={() => onChange({ plan: p.value })}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 14,
                borderRadius: 16, borderWidth: 1.5,
                borderColor: isSelected ? 'rgba(34,197,94,0.50)' : 'rgba(255,255,255,0.10)',
                backgroundColor: isSelected ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.04)',
              }}
            >
              {/* Radio dot */}
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                borderWidth: 2,
                borderColor: isSelected ? T.brand : 'rgba(255,255,255,0.25)',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 14,
              }}>
                {isSelected && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.brand }} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: isSelected ? '#FFFFFF' : '#CCCCCC', fontSize: 15, fontWeight: '700' }}>
                  {p.label}
                </Text>
                <Text style={{ color: '#888888', fontSize: 12, marginTop: 2 }}>
                  {p.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {errors.plan && (
        <Text style={{ color: '#EF4444', fontSize: 12, marginTop: -8, marginBottom: 12 }}>{errors.plan}</Text>
      )}

      <Section title="Trial" />
      <Field
        label="Trial Ends At (ISO date)"
        value={data.trialEndsAt ?? ''}
        onChangeText={(v) => onChange({ trialEndsAt: v })}
        placeholder="e.g. 2026-12-31T00:00:00.000Z"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.trialEndsAt}
      />
    </ScrollView>
  );
}
