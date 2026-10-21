import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, type } from '@/constants/theme';
import { PrimaryButton } from '@/components/common/primitives';

const BENEFITS = [
  { icon: 'cloud-download-outline', title: 'Download & listen offline', body: 'Take your music anywhere, no signal needed.' },
  { icon: 'ban-outline', title: 'Ad-free listening', body: 'Enjoy uninterrupted music and podcasts.' },
  { icon: 'play-skip-forward-outline', title: 'Unlimited skips', body: 'Play any track, any time.' },
  { icon: 'volume-high-outline', title: 'High-quality audio', body: 'Crisp, rich sound on every device.' },
] as const;

// Placeholder pricing only. No billing provider is wired up.
const PLANS = [
  { id: 'student', name: 'Student', price: '$5.99', note: 'Verified students · 1 account', accent: '#8E2DE2' },
  { id: 'individual', name: 'Individual', price: '$11.99', note: '1 account', accent: colors.green, popular: true },
  { id: 'duo', name: 'Duo', price: '$16.99', note: '2 accounts', accent: '#F9A825' },
  { id: 'family', name: 'Family', price: '$19.99', note: 'Up to 6 accounts', accent: '#E91E63' },
] as const;

const COMPARE = [
  { feature: 'Unlimited streaming', free: true, premium: true },
  { feature: 'Ad-free music', free: false, premium: true },
  { feature: 'Offline downloads', free: false, premium: true },
  { feature: 'Unlimited skips', free: false, premium: true },
  { feature: 'Play any song on demand', free: false, premium: true },
  { feature: 'High-quality audio', free: false, premium: true },
];

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function PremiumScreen() {
  const [selected, setSelected] = useState<string>('individual');
  const plan = PLANS.find((p) => p.id === selected)!;

  const upgrade = () =>
    notify(
      'Billing isn’t connected',
      `This demo has no payment provider, so no charge was made for the ${plan.name} plan. Connect a billing service (for example RevenueCat or native in-app purchases) to enable upgrades.`,
    );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#5B2BE0', '#1E88E5', colors.bg]} style={styles.hero}>
        <Text style={styles.heroKicker}>SONARA PREMIUM</Text>
        <Text style={styles.heroTitle}>Music without limits.</Text>
        <Text style={styles.heroBody}>Try free for 1 month, then pick the plan that fits. Cancel anytime.</Text>
        <PrimaryButton label="Get started" variant="white" onPress={upgrade} />
      </LinearGradient>

      <Text style={styles.h2}>Why go Premium</Text>
      <View style={styles.benefits}>
        {BENEFITS.map((b) => (
          <View key={b.title} style={styles.benefit}>
            <Ionicons name={b.icon} size={26} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitBody}>{b.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.h2}>Choose your plan</Text>
      <View style={styles.plans}>
        {PLANS.map((p) => {
          const active = p.id === selected;
          return (
            <View key={p.id} style={[styles.plan, active && { borderColor: p.accent }]}>
              <View style={[styles.planBadge, { backgroundColor: p.accent }]}>
                <Text style={styles.planBadgeText}>{'popular' in p ? 'MOST POPULAR' : p.name.toUpperCase()}</Text>
              </View>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planPrice}>
                {p.price}
                <Text style={styles.planPer}> / month</Text>
              </Text>
              <Text style={styles.planNote}>{p.note}</Text>
              <PrimaryButton label={active ? `Upgrade to ${p.name}` : `Select ${p.name}`} variant={active ? 'green' : 'outline'} onPress={() => (active ? upgrade() : setSelected(p.id))} />
            </View>
          );
        })}
      </View>

      <Text style={styles.h2}>Free vs Premium</Text>
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={[styles.td, styles.th, { flex: 1, textAlign: 'left' }]}>Feature</Text>
          <Text style={[styles.td, styles.th]}>Free</Text>
          <Text style={[styles.td, styles.th, { color: colors.green }]}>Premium</Text>
        </View>
        {COMPARE.map((row) => (
          <View key={row.feature} style={styles.tr}>
            <Text style={[styles.td, { flex: 1, textAlign: 'left' }]}>{row.feature}</Text>
            <View style={styles.tdIcon}>
              <Ionicons name={row.free ? 'checkmark' : 'close'} size={20} color={row.free ? colors.green : colors.textMuted} accessibilityLabel={row.free ? 'Included' : 'Not included'} />
            </View>
            <View style={styles.tdIcon}>
              <Ionicons name="checkmark" size={20} color={colors.green} accessibilityLabel="Included" />
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.legal}>Prices are placeholders for demonstration. No payments are processed in this app.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 24, paddingTop: 32, gap: 12, alignItems: 'flex-start' },
  heroKicker: { ...type.tiny, color: 'rgba(255,255,255,0.8)' },
  heroTitle: { fontSize: 34, fontWeight: '900', color: colors.text, letterSpacing: -0.8 },
  heroBody: { ...type.body, color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  h2: { ...type.title, color: colors.text, paddingHorizontal: 16, marginTop: 28, marginBottom: 12 },
  benefits: { paddingHorizontal: 16, gap: 10 },
  benefit: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: colors.surface, padding: 14, borderRadius: radii.md },
  benefitTitle: { ...type.body, fontWeight: '700', color: colors.text },
  benefitBody: { ...type.small, color: colors.textSecondary, marginTop: 2 },
  plans: { paddingHorizontal: 16, gap: 12 },
  plan: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16, gap: 6, borderWidth: 2, borderColor: 'transparent' },
  planBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, marginBottom: 6 },
  planBadgeText: { fontSize: 10, fontWeight: '800', color: '#000', letterSpacing: 0.8 },
  planName: { fontSize: 22, fontWeight: '800', color: colors.text },
  planPrice: { fontSize: 28, fontWeight: '800', color: colors.text },
  planPer: { ...type.small, color: colors.textSecondary },
  planNote: { ...type.small, color: colors.textSecondary, marginBottom: 10 },
  table: { marginHorizontal: 16, backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 6 },
  tr: { flexDirection: 'row', alignItems: 'center', minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  td: { ...type.small, color: colors.text, width: 72, textAlign: 'center' },
  th: { fontWeight: '800', color: colors.textSecondary },
  tdIcon: { width: 72, alignItems: 'center' },
  legal: { ...type.small, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24, marginTop: 20 },
});
