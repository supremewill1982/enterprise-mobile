import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';

type Tab = 'Accueil' | 'Activité' | 'IA' | 'Alertes' | 'Profil';

const C = {
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  text: '#171717',
  muted: '#737373',
  light: '#A3A3A3',
  border: '#E5E5E5',
  soft: '#F0F0EE',
  success: '#4B6B50',
};

const T = {
  title: 26,
  heading: 20,
  body: 15,
  small: 12,
  label: 10,
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

function Section({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

function Row({
  title,
  subtitle,
  value,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

/* ───────────────────────── ACCUEIL ───────────────────────── */

function HomeScreen() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ESPACE ENTREPRISE</Text>
          <Text style={styles.title}>Bonjour</Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>E</Text>
        </View>
      </View>

      <Section>VUE D’ENSEMBLE</Section>

      <Card>
        <Text style={styles.cardLabel}>Chiffre d’affaires</Text>
        <Text style={styles.revenue}>12 450 000 FCFA</Text>
        <Text style={styles.success}>+8,4 % ce mois</Text>
      </Card>

      <Section>À TRAITER</Section>

      <View style={styles.metrics}>
        <Metric value="4" label="Factures" />
        <Metric value="2" label="Tâches" />
        <Metric value="3" label="Alertes" />
      </View>

      <Section>DÉCISION IA</Section>

      <Card>
        <View style={styles.aiHeader}>
          <View style={styles.dot} />
          <Text style={styles.aiTitle}>Attention requise</Text>
        </View>

        <Text style={styles.aiText}>
          3 décisions nécessitent votre attention.
        </Text>

        <TouchableOpacity style={styles.linkButton}>
          <Text style={styles.linkText}>Voir les décisions</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <Card style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

/* ───────────────────────── ACTIVITÉ ───────────────────────── */

function ActivityScreen() {
  const [module, setModule] = useState<string | null>(null);

  const modules = [
    ['Commercial', 'Clients, prospects, opportunités', '128'],
    ['Finance', 'Factures, dépenses, trésorerie', '12'],
    ['Ressources humaines', 'Équipe, présence, congés', '24'],
    ['Administration', 'Documents, contrats, tâches', '18'],
    ['Communication', 'Messages, annonces, correspondance', '7'],
  ];

  if (module) {
    const data: Record<string, {
      subtitle: string;
      metrics: [string,string,string,string];
      items: [string,string,string][];
    }> = {
      Commercial: {
        subtitle: 'Développez votre activité',
        metrics: ['128','Clients','24','Prospects'],
        items: [
          ['Clients','Consulter et gérer vos clients','128'],
          ['Prospects','Suivre vos prospects','24'],
          ['Opportunités','Pipeline commercial','12'],
          ['Devis','Devis commerciaux en cours','8'],
        ],
      },
      Finance: {
        subtitle: 'Pilotez vos finances',
        metrics: ['36','Factures','8,4 M','Trésorerie'],
        items: [
          ['Factures','Créer et suivre les factures','36'],
          ['Dépenses','Suivre les dépenses','14'],
          ['Paiements','Encaissements et règlements','21'],
          ['Échéances','Factures à surveiller','5'],
        ],
      },
      'Ressources humaines': {
        subtitle: 'Gérez votre équipe',
        metrics: ['24','Employés','22','Présents'],
        items: [
          ['Employés','Fiches et informations','24'],
          ['Présence','Pointage et présence','22'],
          ['Congés','Demandes et absences','3'],
          ['Documents RH','Contrats et dossiers','24'],
        ],
      },
      Administration: {
        subtitle: 'Organisez votre entreprise',
        metrics: ['18','Documents','9','Tâches'],
        items: [
          ['Documents','Centraliser vos documents','18'],
          ['Contrats','Suivre les contrats','7'],
          ['Tâches','Organiser le travail','9'],
          ['Fournisseurs','Gérer vos fournisseurs','16'],
        ],
      },
      Communication: {
        subtitle: 'Centralisez les échanges',
        metrics: ['7','Messages','3','Annonces'],
        items: [
          ['Messages','Communication interne','7'],
          ['Annonces','Informations à diffuser','3'],
          ['Modèles','Emails et courriers','12'],
          ['Notifications','Communications importantes','4'],
        ],
      },
    };

    const d = data[module];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => setModule(null)} style={styles.back}>
          <Text style={styles.backText}>‹ Activité</Text>
        </TouchableOpacity>

        <ScreenHeader title={module} subtitle={d.subtitle} />

        <Section>INDICATEURS</Section>

        <View style={styles.metrics}>
          <Metric value={d.metrics[0]} label={d.metrics[1]} />
          <Metric value={d.metrics[2]} label={d.metrics[3]} />
        </View>

        <Section>GESTION</Section>

        <Card>
          {d.items.map(([title, subtitle, value]) => (
            <Row key={title} title={title} subtitle={subtitle} value={value} />
          ))}
        </Card>

        <Section>IA</Section>

        <Card>
          <View style={styles.aiHeader}>
            <View style={styles.dot} />
            <Text style={styles.aiTitle}>Analyse intelligente</Text>
          </View>
          <Text style={styles.aiText}>
            L’IA pourra analyser les données de ce module et proposer des décisions.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <ScreenHeader title="Activité" subtitle="Gérez votre entreprise" />

      <Section>MODULES</Section>

      <Card>
        {modules.map(([title, subtitle, value]) => (
          <TouchableOpacity
            key={title}
            activeOpacity={0.7}
            onPress={() => setModule(title)}
            style={styles.row}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.rowSubtitle}>{subtitle}</Text>
            </View>
            <Text style={styles.rowValue}>{value}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </Card>
    </ScrollView>
  );
}

/* ───────────────────────── IA ───────────────────────── */

function AIScreen() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <ScreenHeader title="IA" subtitle="Votre intelligence décisionnelle" />

      <Card style={styles.aiMain}>
        <View style={styles.aiLargeIcon}>
          <Text style={styles.aiLargeText}>AI</Text>
        </View>

        <Text style={styles.aiMainTitle}>Que voulez-vous savoir ?</Text>

        <Text style={styles.aiMainText}>
          Posez une question sur votre entreprise ou demandez une analyse.
        </Text>

        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryText}>Poser une question</Text>
        </TouchableOpacity>
      </Card>

      <Section>DÉCISIONS</Section>

      <Card>
        <Row
          title="Décisions en attente"
          subtitle="Nécessitent votre validation"
          value="3"
        />
        <Row
          title="Analyses récentes"
          subtitle="Consultez les dernières analyses"
          value="→"
        />
      </Card>

      <Section>ACTIONS</Section>

      <Card>
        <Row
          title="Actions proposées"
          subtitle="Actions préparées par l'IA"
          value="5"
        />
      </Card>
    </ScrollView>
  );
}

/* ───────────────────────── ALERTES ───────────────────────── */

function AlertsScreen() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <ScreenHeader title="Alertes" subtitle="Ce qui nécessite votre attention" />

      <Section>AUJOURD’HUI</Section>

      <Card>
        <AlertItem
          title="3 décisions à valider"
          subtitle="IA · Il y a 10 min"
        />
        <AlertItem
          title="2 factures arrivent à échéance"
          subtitle="Finance · Il y a 1 h"
        />
        <AlertItem
          title="Une tâche est en retard"
          subtitle="Administration · Il y a 3 h"
        />
      </Card>

      <Section>RÉCENT</Section>

      <Card>
        <AlertItem
          title="Nouveau prospect"
          subtitle="Commercial · Hier"
        />
        <AlertItem
          title="Document ajouté"
          subtitle="Administration · Hier"
        />
      </Card>
    </ScrollView>
  );
}

function AlertItem({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <TouchableOpacity style={styles.alertItem} activeOpacity={0.7}>
      <View style={styles.alertDot} />
      <View>
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ───────────────────────── PROFIL ───────────────────────── */

function ProfileScreen() {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <ScreenHeader title="Profil" subtitle="Compte et entreprise" />

      <Card style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>E</Text>
        </View>

        <Text style={styles.profileName}>Votre entreprise</Text>
        <Text style={styles.profileRole}>Administrateur</Text>
      </Card>

      <Section>ENTREPRISE</Section>

      <Card>
        <Row title="Informations" subtitle="Nom, activité, coordonnées" />
        <Row title="Membres" subtitle="Utilisateurs et rôles" value="4" />
        <Row title="Départements" subtitle="Organisation interne" value="5" />
      </Card>

      <Section>COMPTE</Section>

      <Card>
        <Row title="Abonnement" subtitle="Gérer votre formule" />
        <Row title="Notifications" subtitle="Préférences" />
        <Row title="Sécurité" subtitle="Accès et authentification" />
      </Card>
    </ScrollView>
  );
}

/* ───────────────────────── HEADER ───────────────────────── */

function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.screenHeader}>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.screenSubtitle}>{subtitle}</Text>
    </View>
  );
}

/* ───────────────────────── APP ───────────────────────── */

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Accueil');

  const screens: Record<Tab, React.ReactNode> = {
    Accueil: <HomeScreen />,
    Activité: <ActivityScreen />,
    IA: <AIScreen />,
    Alertes: <AlertsScreen />,
    Profil: <ProfileScreen />,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.bg}
      />

      <View style={styles.container}>
        <View style={styles.content}>{screens[activeTab]}</View>

        <View style={styles.tabBar}>
          {(
            ['Accueil', 'Activité', 'IA', 'Alertes', 'Profil'] as Tab[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab)}
              style={styles.tab}
            >
              <View
                style={[
                  styles.tabIndicator,
                  activeTab === tab && styles.tabIndicatorActive,
                ]}
              />

              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ───────────────────────── DESIGN SYSTEM ───────────────────────── */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },

  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  content: {
    flex: 1,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 28,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  eyebrow: {
    fontSize: T.small,
    letterSpacing: 1,
    fontWeight: '600',
    color: C.muted,
  },

  title: {
    marginTop: 4,
    fontSize: T.title,
    fontWeight: '700',
    color: C.text,
  },

  screenHeader: {
    marginBottom: 10,
  },

  screenTitle: {
    fontSize: T.title,
    fontWeight: '700',
    color: C.text,
  },

  screenSubtitle: {
    marginTop: 4,
    fontSize: T.body,
    color: C.muted,
  },

  back: {
    marginBottom: 16,
  },

  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },

  pipelineRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  pipelineValue: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pipelineValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: C.surface,
    fontSize: 15,
    fontWeight: '700',
  },

  section: {
    marginTop: 20,
    marginBottom: 9,
    fontSize: T.label,
    letterSpacing: 1,
    fontWeight: '700',
    color: C.muted,
  },

  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 17,
  },

  cardLabel: {
    fontSize: T.small,
    color: C.muted,
  },

  revenue: {
    marginTop: 7,
    fontSize: 27,
    fontWeight: '700',
    color: C.text,
  },

  success: {
    marginTop: 7,
    fontSize: T.small,
    fontWeight: '600',
    color: C.success,
  },

  metrics: {
    flexDirection: 'row',
    gap: 9,
  },

  metric: {
    flex: 1,
    padding: 15,
  },

  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
  },

  metricLabel: {
    marginTop: 4,
    fontSize: T.small,
    color: C.muted,
  },

  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.text,
    marginRight: 8,
  },

  aiTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },

  aiText: {
    marginTop: 10,
    fontSize: T.body,
    lineHeight: 21,
    color: C.muted,
  },

  linkButton: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },

  arrow: {
    fontSize: 18,
    color: C.text,
  },

  row: {
    minHeight: 66,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  rowText: {
    flex: 1,
    paddingRight: 10,
  },

  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },

  rowSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },

  rowValue: {
    marginRight: 8,
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },

  chevron: {
    fontSize: 23,
    color: C.light,
  },

  aiMain: {
    padding: 20,
  },

  aiLargeIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  aiLargeText: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
  },

  aiMainTitle: {
    fontSize: T.heading,
    fontWeight: '700',
    color: C.text,
  },

  aiMainText: {
    marginTop: 7,
    fontSize: T.body,
    lineHeight: 21,
    color: C.muted,
  },

  primaryButton: {
    marginTop: 18,
    height: 48,
    borderRadius: 13,
    backgroundColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryText: {
    color: C.surface,
    fontSize: 14,
    fontWeight: '700',
  },

  alertItem: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.text,
    marginRight: 12,
  },

  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },

  alertSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: C.muted,
  },

  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileAvatarText: {
    color: C.surface,
    fontSize: 22,
    fontWeight: '700',
  },

  profileName: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },

  profileRole: {
    marginTop: 4,
    fontSize: 13,
    color: C.muted,
  },

  tabBar: {
    height: 72,
    paddingHorizontal: 5,
    paddingBottom: 7,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    flexDirection: 'row',
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabIndicator: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 2,
    backgroundColor: 'transparent',
  },

  tabIndicatorActive: {
    backgroundColor: C.text,
  },

  tabText: {
    fontSize: 10,
    color: C.light,
  },

  tabTextActive: {
    color: C.text,
    fontWeight: '700',
  },
});
