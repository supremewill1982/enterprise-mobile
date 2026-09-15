import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LoginScreen from './LoginScreen';
import CustomersScreen from './features/customers/CustomersScreen';
import SuppliersScreen from './features/suppliers/SuppliersScreen';
import EmployeesScreen from './features/employees/EmployeesScreen';
import TasksScreen from './features/tasks/TasksScreen';
import InvoicesScreen from './features/invoices/InvoicesScreen';
import QuotesScreen from './features/quotes/QuotesScreen';
import ExpensesScreen from './features/expenses/ExpensesScreen';
import PaymentsScreen from './features/payments/PaymentsScreen';
import NotificationsScreen from './features/notifications/NotificationsScreen';
import DocumentsEntrepriseScreen from './features/documents/DocumentsEntrepriseScreen';
import { supabase } from './lib/supabase';
import { PermissionsProvider, usePermissions } from './lib/PermissionsContext';
import {
  askAI,
  confirmAIAction,
  executeAIAction,
  AIActionProposal,
} from './lib/aiService';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

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

function HomeScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { role, can } = usePermissions();
  const [counts, setCounts] = useState({
    clients: 0,
    invoices: 0,
    employees: 0,
    tasks: 0,
    alerts: 0,
  });
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  async function loadData() {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;

    const { data: memberships } = await supabase
      .schema('enterprise')
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId);

    const organizationIds = (memberships ?? []).map(
      (m) => m.organization_id,
    );

    if (!organizationIds.length) return;

    const tables = [
      'customers',
      'invoices',
      'employees',
      'tasks',
      'notifications',
    ] as const;

    const results = await Promise.all(
      tables.map((table) =>
        supabase
          .schema('enterprise')
          .from(table)
          .select('*', { count: 'exact', head: true })
          .in('organization_id', organizationIds),
      ),
    );

    const { data: taskRows } = await supabase
      .schema('enterprise')
      .from('tasks')
      .select('*')
      .in('organization_id', organizationIds)
      .order('created_at', { ascending: false })
      .limit(8);

    setCounts({
      clients: results[0].count ?? 0,
      invoices: results[1].count ?? 0,
      employees: results[2].count ?? 0,
      tasks: results[3].count ?? 0,
      alerts: results[4].count ?? 0,
    });

    setTasks(taskRows ?? []);
    setLoadingTasks(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ESPACE ENTREPRISE</Text>
          <Text style={styles.title}>
            {role === 'OWNER' || role === 'ADMIN'
              ? 'Pilotage'
              : role === 'FINANCE'
              ? 'Finance'
              : role === 'HR'
              ? 'Ressources humaines'
              : role === 'COMMERCIAL'
              ? 'Commercial'
              : role === 'MANAGER'
              ? 'Mon activité'
              : 'Mon espace'}
          </Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>E</Text>
        </View>
      </View>

      {(can('direction', 'view') || can('finance', 'view')) && (
        <>
          <Section>VUE D’ENSEMBLE</Section>
          <Card>
            <Text style={styles.cardLabel}>Chiffre d’affaires</Text>
            <Text style={styles.revenue}>— FCFA</Text>
            <Text style={styles.success}>Données réelles à venir</Text>
          </Card>
        </>
      )}

      <Section>À TRAITER</Section>

      <View style={styles.metrics}>
        {can('finance', 'view') && (
          <Metric value={String(counts.invoices)} label="Factures" />
        )}
        {can('tasks', 'view') && (
          <Metric value={String(counts.tasks)} label="Tâches" />
        )}
        <Metric value={String(counts.alerts)} label="Alertes" />
      </View>

      {can('tasks', 'view') && (
        <>
          <Section>TÂCHES</Section>

          <Card>
            {loadingTasks ? (
              <Text style={styles.rowSubtitle}>Chargement…</Text>
            ) : tasks.length === 0 ? (
              <Text style={styles.rowSubtitle}>
                Aucune tâche à traiter.
              </Text>
            ) : (
              tasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <View style={styles.taskMain}>
                    <Text style={styles.taskTitle}>
                      {task.title ?? task.name ?? 'Tâche sans titre'}
                    </Text>

                    <Text style={styles.taskMeta}>
                      {task.priority
                        ? `Priorité : ${task.priority}`
                        : task.status
                        ? `Statut : ${task.status}`
                        : 'À traiter'}
                      {task.due_date
                        ? ` · Échéance : ${task.due_date}`
                        : ''}
                    </Text>
                  </View>

                  <Text style={styles.taskStatus}>
                    {task.status ?? 'ouverte'}
                  </Text>
                </View>
              ))
            )}

            <Pressable
              style={styles.linkButton}
              onPress={() => onNavigate('Activité')}
            >
              <Text style={styles.linkText}>Voir toutes les tâches</Text>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
          </Card>
        </>
      )}

      <Section>DÉCISION IA</Section>

      <Card>
        <View style={styles.aiHeader}>
          <View style={styles.dot} />
          <Text style={styles.aiTitle}>Assistant opérationnel</Text>
        </View>

        <Text style={styles.aiText}>
          Posez une question ou demandez à l’IA de préparer une action.
        </Text>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => onNavigate('IA')}
        >
          <Text style={styles.linkText}>Ouvrir l’assistant IA</Text>
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
  const { can } = usePermissions();
  const [showCustomers, setShowCustomers] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [data, setData] = useState({
    quotes: 0,
    clients: 0,
    invoices: 0,
    employees: 0,
    suppliers: 0,
    tasks: 0,
    expenses: 0,
    payments: 0,
  });

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;

      const { data: memberships } = await supabase
        .schema("enterprise")
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId);

      const organizationIds = (memberships ?? []).map(
        (m) => m.organization_id
      );

      if (!organizationIds.length) return;

      const tables = [
        "customers",
        "invoices",
        "quotes",
        "employees",
        "suppliers",
        "tasks",
        "expenses",
        "payments",
      ] as const;

      const results = await Promise.all(
        tables.map((table) =>
          supabase
            .schema("enterprise")
            .from(table)
            .select("*", { count: "exact", head: true })
            .in("organization_id", organizationIds)
        )
      );

      if (!mounted) return;

      setData({
        clients: results[0].count ?? 0,
        invoices: results[1].count ?? 0,
        quotes: results[2].count ?? 0,
        employees: results[3].count ?? 0,
        suppliers: results[4].count ?? 0,
        tasks: results[5].count ?? 0,
        expenses: results[6].count ?? 0,
        payments: results[7].count ?? 0,
      });
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  if (showCustomers) {
    return (
      <CustomersScreen
        onBack={() => setShowCustomers(false)}
      />
    );
  }

  if (showSuppliers) {
    return (
      <SuppliersScreen
        onBack={() => setShowSuppliers(false)}
      />
    );
  }

  if (showEmployees) {
    return (
      <EmployeesScreen
        onBack={() => setShowEmployees(false)}
      />
    );
  }

  if (showTasks) {
    return (
      <TasksScreen
        onBack={() => setShowTasks(false)}
      />
    );
  }

  if (showInvoices) {
    return (
      <InvoicesScreen
        onBack={() => setShowInvoices(false)}
      />
    );
  }

  const modules = [
    ...(can("commercial", "view")
      ? [{
      title: "Commercial",
      subtitle: "Clients et activité commerciale",
      metrics: [
        ["Clients", String(data.clients)],
        ["Prospects", "—"],
        ["Opportunités", "—"],
        ["Devis", "—"],
      ] as [string, string][],
    },
    ]
      : []),
    ...(can("finance", "view")
      ? [{
      title: "Finance",
      subtitle: "Factures, dépenses et paiements",
      metrics: [
        ["Factures", String(data.invoices)],
      ["Devis", String(data.quotes)],
        ["Dépenses", String(data.expenses)],
        ["Paiements", String(data.payments)],
        ["Trésorerie", "—"],
      ] as [string, string][],
    },
    ]
      : []),
    ...(can("hr", "view")
      ? [{
      title: "Ressources humaines",
      subtitle: "Équipe et collaborateurs",
      metrics: [
        ["Employés", String(data.employees)],
        ["Présence", "—"],
        ["Congés", "—"],
        ["Documents RH", "—"],
      ] as [string, string][],
    },
    ]
      : []),
    ...(can("tasks", "view")
      ? [{
      title: "Administration",
      subtitle: "Tâches et fournisseurs",
      metrics: [
        ["Tâches", String(data.tasks)],
        ["Fournisseurs", String(data.suppliers)],
        ["Documents", "—"],
        ["Contrats", "—"],
      ] as [string, string][],
    },
    ]
      : []),
    ...(can("communication", "view")
      ? [{
      title: "Communication",
      subtitle: "Communication interne",
      metrics: [
        ["Messages", "—"],
        ["Annonces", "—"],
        ["Modèles", "—"],
        ["Notifications", "—"],
      ] as [string, string][],
    },
    ]
      : []),
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <ScreenHeader
        title="Activité"
        subtitle="Vue d'ensemble de votre entreprise"
      />

      {modules.map((module) => (
        <Card key={module.title}>
          <Text style={styles.moduleTitle}>{module.title}</Text>
          <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>

          <View style={styles.metricsGrid}>
            {module.metrics.map(([label, value]) => {
              const isClients =
                module.title === "Commercial" && label === "Clients";
              const isSuppliers =
                module.title === "Administration" && label === "Fournisseurs";
              const isEmployees =
                module.title === "Ressources humaines" && label === "Employés";
              const isTasks =
                module.title === "Administration" && label === "Tâches";
              const isInvoices =
                module.title === "Finance" && label === "Factures";
              const isQuotes =
                module.title === "Finance" && label === "Devis";

              return (
                <Pressable
                  key={label}
                  style={styles.metricBox}
                  onPress={
                    isClients
                      ? () => setShowCustomers(true)
                      : isSuppliers
                        ? () => setShowSuppliers(true)
                        : isEmployees
                        ? () => setShowEmployees(true)
                        : isTasks
                          ? () => setShowTasks(true)
                          : isInvoices
                            ? () => setShowInvoices(true)
                            : isQuotes
                              ? () => setShowQuotes(true)
                              : undefined
                  }
                  disabled={
                    !isClients &&
                    !isSuppliers &&
                    !isEmployees &&
                    !isTasks &&
                    !isInvoices &&
                    !isQuotes
                  }
                >
                  <Text style={styles.metricValue}>{value}</Text>
                  <Text style={styles.metricLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}


/* ───────────────────────── IA ───────────────────────── */

function AIScreen({ onNavigate: _onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [message, setMessage] = React.useState('');
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [conversations, setConversations] = React.useState<any[]>([]);
  const [proposal, setProposal] = React.useState<AIActionProposal | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [riskWarning, setRiskWarning] = React.useState(false);
  const [listVisible, setListVisible] = React.useState(false);

  async function loadConversations() {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;

    const { data } = await supabase
      .schema('enterprise')
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    setConversations(data ?? []);
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .schema('enterprise')
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    setMessages(
      (data ?? []).map((row) => ({
        id: row.id,
        role: row.role === 'user' ? 'user' : 'assistant',
        content: row.content ?? '',
        created_at: row.created_at,
      })),
    );

    setConversationId(id);
    setProposal(null);
    setActionMessage(null);
    setError(null);
    setListVisible(false);
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setProposal(null);
    setActionMessage(null);
    setError(null);
    setMessage('');
    setListVisible(false);
  }

  useEffect(() => {
    loadConversations();
  }, []);

  async function handleAsk() {
    const cleanMessage = message.trim();

    if (!cleanMessage || loading || actionLoading) return;

    const temporaryId = `local-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: temporaryId,
        role: 'user',
        content: cleanMessage,
      },
    ]);

    setMessage('');
    setLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const result = await askAI(cleanMessage, conversationId);

      setConversationId(result.conversation_id);

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.answer,
        },
      ]);

      setProposal(result.action_proposal);
      await loadConversations();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de contacter l’Agent IA.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmAndExecute() {
    if (!proposal || actionLoading) return;

    if (proposal.risk_level === 'high' || proposal.risk_level === 'critical') {
      if (!riskWarning) {
        setRiskWarning(true);
        return;
      }
    }

    setActionLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const confirmed = await confirmAIAction(proposal.id);

      if (!confirmed.proposal) {
        throw new Error('La proposition n’a pas pu être confirmée.');
      }

      const updated = {
        ...proposal,
        ...confirmed.proposal,
      };

      setProposal(updated);

      const count = updated.confirmation_count ?? 0;
      const required = updated.required_confirmations ?? 1;

      if (count < required) {
        setActionMessage(
          `Confirmation ${count}/${required}. Une confirmation supplémentaire est nécessaire.`,
        );
        setRiskWarning(false);
        return;
      }

      const executed = await executeAIAction(proposal.id);

      setProposal({
        ...updated,
        ...(executed.proposal ?? {}),
        status: 'executed',
      });

      setActionMessage(
        executed.message ?? 'Action exécutée avec succès.',
      );
      setRiskWarning(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de confirmer ou d’exécuter l’action.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelAction() {
    if (!proposal || actionLoading) return;

    Alert.alert(
      'Annuler cette action ?',
      'L’action ne sera pas exécutée.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler l’action',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);

            try {
              const cancelled = await confirmAIAction(proposal.id, {
                cancel: true,
              });

              setProposal({
                ...proposal,
                ...(cancelled.proposal ?? {}),
                status: 'cancelled',
              });

              setActionMessage(
                'Action annulée. Aucune modification n’a été effectuée.',
              );
              setRiskWarning(false);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Impossible d’annuler l’action.',
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.aiContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.aiTopBar}>
        <View>
          <Text style={styles.screenTitle}>Assistant IA</Text>
          <Text style={styles.screenSubtitle}>
            Votre assistant opérationnel
          </Text>
        </View>

        <View style={styles.aiTopActions}>
          <Pressable
            style={styles.aiTopButton}
            onPress={() => setListVisible((v) => !v)}
          >
            <Text style={styles.aiTopButtonText}>Historique</Text>
          </Pressable>

          <Pressable style={styles.aiTopButton} onPress={newChat}>
            <Text style={styles.aiTopButtonText}>+ Nouveau</Text>
          </Pressable>
        </View>
      </View>

      {listVisible && (
        <Card style={styles.conversationPanel}>
          <Text style={styles.moduleTitle}>Conversations</Text>

          <ScrollView style={{ maxHeight: 190 }}>
            {conversations.length === 0 ? (
              <Text style={styles.rowSubtitle}>
                Aucune conversation enregistrée.
              </Text>
            ) : (
              conversations.map((conversation) => (
                <Pressable
                  key={conversation.id}
                  style={styles.conversationRow}
                  onPress={() => loadMessages(conversation.id)}
                >
                  <Text style={styles.conversationTitle}>
                    {conversation.title || 'Nouvelle conversation'}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Card>
      )}

      <ScrollView
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatTitle}>Comment puis-je vous aider ?</Text>
            <Text style={styles.emptyChatText}>
              Posez une question sur votre entreprise ou demandez à l’IA de préparer une action.
            </Text>
          </View>
        )}

        {messages.map((item) => (
          <View
            key={item.id}
            style={[
              styles.messageRow,
              item.role === 'user'
                ? styles.messageRowUser
                : styles.messageRowAssistant,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                item.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  item.role === 'user'
                    ? styles.userMessageText
                    : styles.assistantMessageText,
                ]}
              >
                {item.content}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.messageRowAssistant}>
            <View style={styles.assistantBubble}>
              <Text style={styles.messageText}>Analyse en cours…</Text>
            </View>
          </View>
        )}

        {proposal &&
          proposal.status !== 'executed' &&
          proposal.status !== 'cancelled' && (
            <Card style={styles.actionCard}>
              <Text style={styles.moduleTitle}>Action proposée</Text>

              <Text style={styles.moduleSubtitle}>
                {proposal.rationale ??
                  'Cette action nécessite votre validation.'}
              </Text>

              <Text style={styles.actionRisk}>
                Risque : {proposal.risk_level}
              </Text>

              {riskWarning && (
                <View style={styles.riskWarning}>
                  <Text style={styles.riskWarningTitle}>
                    Attention
                  </Text>
                  <Text style={styles.riskWarningText}>
                    Cette action peut entraîner une perte de données.
                    Voulez-vous vraiment continuer ?
                  </Text>
                </View>
              )}

              <View style={styles.actionButtons}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={handleConfirmAndExecute}
                  disabled={actionLoading}
                >
                  <Text style={styles.primaryText}>
                    {riskWarning
                      ? 'Confirmer malgré le risque'
                      : 'Continuer'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCancelAction}
                  disabled={actionLoading}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </Pressable>
              </View>

              {actionMessage && (
                <Text style={styles.actionMessage}>
                  {actionMessage}
                </Text>
              )}
            </Card>
          )}

        {proposal?.status === 'cancelled' && (
          <Card style={styles.actionCard}>
            <Text style={styles.success}>
              Action annulée. Aucune modification n’a été effectuée.
            </Text>
          </Card>
        )}

        {proposal?.status === 'executed' && (
          <Card style={styles.actionCard}>
            <Text style={styles.success}>
              Action exécutée avec succès.
            </Text>
          </Card>
        )}

        {error && (
          <Text style={styles.aiError}>{error}</Text>
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Écrire un message…"
          placeholderTextColor={C.light}
          multiline
          editable={!loading && !actionLoading}
          scrollEnabled
          style={styles.composerInput}
        />

        <Pressable
          style={[
            styles.sendButton,
            {
              opacity:
                loading || actionLoading || !message.trim()
                  ? 0.45
                  : 1,
            },
          ]}
          onPress={handleAsk}
          disabled={
            loading || actionLoading || !message.trim()
          }
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}


/* ───────────────────────── ALERTES ───────────────────────── */

function AlertsScreen() {
  const [alerts, setAlerts] = useState<{ id: string; title: string; message: string; created_at: string }[]>([]);

  useEffect(() => {
    async function loadAlerts() {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;

      const { data } = await supabase
        .schema('enterprise')
        .from('notifications')
        .select('id,title,message,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setAlerts(data ?? []);
    }
    loadAlerts();
  }, []);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <ScreenHeader title="Alertes" subtitle="Ce qui nécessite votre attention" />

      <Section>NOTIFICATIONS</Section>
      <Card>
        {alerts.length === 0 ? (
          <Text style={styles.rowSubtitle}>Aucune notification.</Text>
        ) : (
          alerts.map((alert) => (
            <AlertItem
              key={alert.id}
              title={alert.title}
              subtitle={alert.message}
            />
          ))
        )}
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
  const [showDocuments, setShowDocuments] = useState(false);

  const [profile, setProfile] = useState({
    email: "—",
    organization: "—",
    role: "—",
    members: "—",
    departments: "—",
  });

  useEffect(() => {
    async function loadProfile() {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      if (!user) return;

      const { data: membership } = await supabase
        .schema("enterprise")
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!membership) {
        setProfile((current) => ({ ...current, email: user.email ?? "—" }));
        return;
      }

      const organizationId = membership.organization_id;

      const [{ data: organization }, { count: members }, { data: employees }] =
        await Promise.all([
          supabase
            .schema("enterprise")
            .from("organizations")
            .select("name")
            .eq("id", organizationId)
            .maybeSingle(),
          supabase
            .schema("enterprise")
            .from("organization_members")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organizationId),
          supabase
            .schema("enterprise")
            .from("employees")
            .select("department")
            .eq("organization_id", organizationId)
            .not("department", "is", null),
        ]);

      const departments = new Set(
        (employees ?? [])
          .map((employee) => employee.department)
          .filter(Boolean)
      ).size;

      setProfile({
        email: user.email ?? "—",
        organization: organization?.name ?? "—",
        role: membership.role ?? "—",
        members: String(members ?? 0),
        departments: String(departments),
      });
    }

    loadProfile();
  }, []);

  if (showDocuments) {
    return (
      <DocumentsEntrepriseScreen
        onBack={() => setShowDocuments(false)}
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <ScreenHeader title="Profil" subtitle="Compte et entreprise" />

      <Card style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {(profile.organization[0] ?? "E").toUpperCase()}
          </Text>
        </View>

        <Text style={styles.profileName}>{profile.organization}</Text>
        <Text style={styles.profileRole}>{profile.role}</Text>
        <Text style={styles.rowSubtitle}>{profile.email}</Text>
      </Card>

      <Section>ENTREPRISE</Section>

      <Card>
        <Row title="Informations" subtitle="Nom, activité, coordonnées" />
        <Row title="Membres" subtitle="Utilisateurs et rôles" value={profile.members} />
        <Row title="Départements" subtitle="Organisation interne" value={profile.departments} />

        <Pressable
          onPress={() => setShowDocuments(true)}
          style={styles.documentProfileRow}
        >
          <View style={styles.documentProfileText}>
            <Text style={styles.rowTitle}>Documents & modèles</Text>
            <Text style={styles.rowSubtitle}>
              Devis, factures et règles documentaires
            </Text>
          </View>
          <Text style={styles.documentProfileArrow}>›</Text>
        </Pressable>
      </Card>

      <Section>COMPTE</Section>

      <Card>
        <Row title="Abonnement" subtitle="Gérer votre formule" />
        <Row title="Notifications" subtitle="Préférences" />
        <Row title="Sécurité" subtitle="Accès et authentification" />

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={styles.documentProfileRow}
        >
          <View style={styles.documentProfileText}>
            <Text style={styles.rowTitle}>Déconnexion</Text>
            <Text style={styles.rowSubtitle}>
              Se déconnecter de ce compte
            </Text>
          </View>
          <Text style={styles.documentProfileArrow}>›</Text>
        </Pressable>
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

function PasswordResetScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmation, setShowConfirmation] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleReset() {
    if (password.length < 6) {
      Alert.alert('Mot de passe invalide', 'Utilise au moins 6 caractères.');
      return;
    }
    if (password !== confirmation) {
      Alert.alert('Confirmation incorrecte', 'Les deux mots de passe doivent être identiques.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }

    Alert.alert('Mot de passe modifié', 'Ton nouveau mot de passe est enregistré.', [
      { text: 'Continuer', onPress: onDone },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
            Nouveau mot de passe
          </Text>
          <Text style={{ color: '#64748B', marginBottom: 24 }}>
            Choisis un nouveau mot de passe pour ton compte Enterprise.
          </Text>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontWeight: '700', color: '#334155', marginBottom: 8 }}>
              Nouveau mot de passe
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="6 caractères minimum"
                autoCapitalize="none"
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 12,
                  padding: 14,
                }}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={{ marginLeft: 10 }}>
                <Text style={{ color: '#2563EB', fontWeight: '700' }}>
                  {showPassword ? 'Masquer' : 'Afficher'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontWeight: '700', color: '#334155', marginBottom: 8 }}>
              Confirmer le mot de passe
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry={!showConfirmation}
                placeholder="Répète le mot de passe"
                autoCapitalize="none"
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 12,
                  padding: 14,
                }}
              />
              <Pressable onPress={() => setShowConfirmation(!showConfirmation)} style={{ marginLeft: 10 }}>
                <Text style={{ color: '#2563EB', fontWeight: '700' }}>
                  {showConfirmation ? 'Masquer' : 'Afficher'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleReset}
            disabled={loading}
            style={{
              backgroundColor: '#2563EB',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
              {loading ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = React.useState(false);
  const [passwordRecovery, setPasswordRecovery] = React.useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Accueil');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
    });

    const handleUrl = (url: string | null) => {
      if (url?.includes('/auth/reset')) {
        setPasswordRecovery(true);
      }
    };

    Linking.getInitialURL().then(handleUrl);

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthenticated(!!session);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
    });

    return () => {
      urlSubscription.remove();
      listener.subscription.unsubscribe();
    };
  }, []);

  if (passwordRecovery) {
    return (
      <PasswordResetScreen
        onDone={() => {
          setPasswordRecovery(false);
          setAuthenticated(false);
          supabase.auth.signOut();
        }}
      />
    );
  }

  if (!authenticated) return <LoginScreen onLogin={() => {}} />;

  const screens: Record<Tab, React.ReactNode> = {
    Accueil: <HomeScreen onNavigate={setActiveTab} />,
    Activité: <ActivityScreen />,
    IA: <AIScreen onNavigate={setActiveTab} />,
    Alertes: <AlertsScreen />,
    Profil: <ProfileScreen />,
  };

  return (
    <PermissionsProvider>
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
    </PermissionsProvider>
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

  moduleTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#171717",
    marginBottom: 4,
  },
  moduleSubtitle: {
    fontSize: 13,
    color: "#737373",
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  metricBox: {
    width: "50%",
    paddingHorizontal: 5,
    paddingVertical: 8,
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

  documentProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  documentProfileText: {
    flex: 1,
  },
  documentProfileArrow: {
    marginLeft: 12,
    fontSize: 24,
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

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  taskMain: {
    flex: 1,
  },

  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },

  taskMeta: {
    marginTop: 4,
    fontSize: 12,
    color: C.muted,
  },

  taskStatus: {
    marginLeft: 8,
    fontSize: 11,
    color: C.muted,
  },

  aiContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },

  aiTopBar: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  aiTopActions: {
    flexDirection: 'row',
    gap: 6,
  },

  aiTopButton: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  aiTopButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text,
  },

  conversationPanel: {
    marginHorizontal: 20,
    marginBottom: 8,
  },

  conversationRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },

  conversationTitle: {
    fontSize: 13,
    color: C.text,
    fontWeight: '600',
  },

  chatScroll: {
    flex: 1,
  },

  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 100,
  },

  emptyChatTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },

  emptyChatText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    textAlign: 'center',
  },

  messageRow: {
    width: '100%',
    marginVertical: 5,
  },

  messageRowUser: {
    alignItems: 'flex-end',
  },

  messageRowAssistant: {
    alignItems: 'flex-start',
  },

  messageBubble: {
    maxWidth: '86%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  userBubble: {
    backgroundColor: C.text,
  },

  assistantBubble: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },

  userMessageText: {
    color: C.surface,
  },

  assistantMessageText: {
    color: C.text,
  },

  actionCard: {
    marginTop: 10,
  },

  actionRisk: {
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },

  riskWarning: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#E5C58A',
    marginBottom: 12,
  },

  riskWarningTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text,
    marginBottom: 4,
  },

  riskWarningText: {
    fontSize: 13,
    lineHeight: 19,
    color: C.text,
  },

  actionButtons: {
    gap: 8,
  },

  cancelButton: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
  },

  actionMessage: {
    marginTop: 10,
    fontSize: 13,
    color: C.muted,
  },

  aiError: {
    margin: 12,
    fontSize: 13,
    color: '#B42318',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 18 : 10,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },

  composerInput: {
    flex: 1,
    maxHeight: 110,
    minHeight: 46,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 10,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.bg,
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.text,
  },

  sendButtonText: {
    color: C.surface,
    fontSize: 22,
    fontWeight: '700',
  },
});
