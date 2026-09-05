import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const COLORS = {
  background: '#F7F7F5',
  surface: '#FFFFFF',
  text: '#171717',
  secondary: '#737373',
  border: '#E5E5E5',
  primary: '#171717',
  muted: '#F0F0EE',
};

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Action({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.action}>
      <Text style={styles.actionValue}>{value}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour</Text>
            <Text style={styles.name}>Votre entreprise</Text>
          </View>

          <TouchableOpacity style={styles.avatar} activeOpacity={0.7}>
            <Text style={styles.avatarText}>E</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionLabel}>VUE D’ENSEMBLE</Text>

          <Card style={styles.revenueCard}>
            <Text style={styles.cardLabel}>Chiffre d’affaires</Text>
            <Text style={styles.revenue}>12 450 000 FCFA</Text>
            <Text style={styles.positive}>+8,4 % ce mois</Text>
          </Card>

          <Text style={styles.sectionLabel}>À TRAITER</Text>

          <View style={styles.actions}>
            <Action title="Factures" value="4" />
            <Action title="Tâches" value="2" />
            <Action title="Alertes" value="3" />
          </View>

          <Text style={styles.sectionLabel}>DÉCISION IA</Text>

          <Card>
            <View style={styles.aiHeader}>
              <View style={styles.aiDot} />
              <Text style={styles.aiTitle}>Attention requise</Text>
            </View>

            <Text style={styles.aiText}>
              3 décisions nécessitent votre attention.
            </Text>

            <TouchableOpacity activeOpacity={0.7} style={styles.aiButton}>
              <Text style={styles.aiButtonText}>Voir les décisions</Text>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.tabBar}>
          <Tab label="Accueil" active />
          <Tab label="Activité" />
          <Tab label="IA" />
          <Tab label="Alertes" />
          <Tab label="Profil" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Tab({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.tab} activeOpacity={0.7}>
      <Text style={[styles.tabText, active && styles.tabActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  greeting: {
    fontSize: 14,
    color: COLORS.secondary,
  },

  name: {
    marginTop: 3,
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: '600',
  },

  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
  },

  sectionLabel: {
    marginTop: 18,
    marginBottom: 9,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  revenueCard: {
    paddingVertical: 20,
  },

  cardLabel: {
    fontSize: 13,
    color: COLORS.secondary,
  },

  revenue: {
    marginTop: 8,
    fontSize: 27,
    fontWeight: '700',
    color: COLORS.text,
  },

  positive: {
    marginTop: 7,
    fontSize: 13,
    color: '#4B6B50',
  },

  actions: {
    flexDirection: 'row',
    gap: 9,
  },

  action: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  actionValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },

  actionTitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.secondary,
  },

  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text,
    marginRight: 8,
  },

  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  aiText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.secondary,
  },

  aiButton: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  aiButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  arrow: {
    fontSize: 18,
    color: COLORS.text,
  },

  tabBar: {
    height: 72,
    paddingHorizontal: 8,
    paddingBottom: 7,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabText: {
    fontSize: 11,
    color: '#999999',
  },

  tabActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
});
