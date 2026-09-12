import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createTask,
  deleteTask,
  listTasks,
  Task,
  updateTask,
} from './taskService';

const STATUS = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminée',
} as const;

const PRIORITY = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
} as const;

import { usePermission } from '../../lib/usePermission';
export default function TasksScreen({


  onBack,
}: {
  onBack?: () => void;
}) {
  const { allowed: canView } = usePermission('tasks', 'view');
  const { allowed: canCreate } = usePermission('tasks', 'create');
  const { allowed: canEdit } = usePermission('tasks', 'edit');
  const { allowed: canDelete } = usePermission('tasks', 'delete');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('normal');
  const [dueAt, setDueAt] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTasks(await listTasks());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Impossible de charger les tâches.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    loadTasks();
  }, [loadTasks, canView]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setStatus('todo');
    setPriority('normal');
    setDueAt('');
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setModalVisible(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description ?? '');
    setAssignedTo(task.assigned_to ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setDueAt(
      task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : '',
    );
    setModalVisible(true);
  }

  async function save() {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier tâche.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer tâche.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Informations requises', 'Le titre est obligatoire.');
      return;
    }

    let dueDate: string | null = null;

    if (dueAt.trim()) {
      const parsed = new Date(`${dueAt.trim()}T23:59:59`);
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert(
          'Échéance invalide',
          'Utilisez le format AAAA-MM-JJ.',
        );
        return;
      }
      dueDate = parsed.toISOString();
    }

    try {
      setSaving(true);

      const input = {
        title,
        description,
        assigned_to: assignedTo.trim() || null,
        status,
        priority,
        due_at: dueDate,
      };

      if (editing) {
        await updateTask(editing.id, input);
      } else {
        await createTask(input);
      }

      setModalVisible(false);
      await loadTasks();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer la tâche.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(task: Task) {
    if (!canDelete) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de supprimer tâche.');
      return;
    }

    Alert.alert(
      'Supprimer la tâche',
      `Voulez-vous supprimer « ${task.title} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(task.id);
              await loadTasks();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error
                  ? e.message
                  : 'Impossible de supprimer la tâche.',
              );
            }
          },
        },
      ],
    );
  }

  const filtered = tasks.filter((task) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      task.title,
      task.description ?? '',
      task.status,
      task.priority,
      task.assigned_to ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Tâches</Text>
          <Text style={styles.subtitle}>
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
          </Text>
        </View>

        {canCreate && <Pressable onPress={openCreate} style={styles.addButton}>
          <Text style={styles.addText}>+ Nouvelle</Text>
        </Pressable>}
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher une tâche..."
        placeholderTextColor="#A3A3A3"
        style={styles.search}
      />

      {loading ? (
        <Text style={styles.info}>Chargement...</Text>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={loadTasks} style={styles.retry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {tasks.length === 0 ? 'Aucune tâche' : 'Aucun résultat'}
          </Text>
          <Text style={styles.emptyText}>
            {tasks.length === 0
              ? 'Créez votre première tâche.'
              : 'Modifiez votre recherche.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((task) => (
            <View key={task.id} style={styles.card}>
              <Pressable onPress={canEdit ? () => openEdit(task) : undefined}>
                <Text style={styles.taskTitle}>{task.title}</Text>

                {task.description ? (
                  <Text style={styles.description} numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}

                <View style={styles.badges}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {STATUS[task.status as keyof typeof STATUS] ??
                        task.status}
                    </Text>
                  </View>

                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {PRIORITY[task.priority as keyof typeof PRIORITY] ??
                        task.priority}
                    </Text>
                  </View>
                </View>

                {task.due_at ? (
                  <Text style={styles.detail}>
                    Échéance :{' '}
                    {new Date(task.due_at).toLocaleDateString('fr-FR')}
                  </Text>
                ) : null}

                {task.assigned_to ? (
                  <Text style={styles.detail}>
                    Responsable : {task.assigned_to}
                  </Text>
                ) : null}
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  onPress={canEdit ? () => openEdit(task) : undefined}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>Modifier</Text>
                </Pressable>

                {canDelete && (
                  <Pressable
                    onPress={() => confirmDelete(task)}
                    style={styles.action}
                  >
                    <Text style={styles.deleteText}>Supprimer</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {editing ? 'Modifier la tâche' : 'Nouvelle tâche'}
              </Text>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Titre *"
                placeholderTextColor="#A3A3A3"
                style={styles.input}
              />

              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                placeholderTextColor="#A3A3A3"
                multiline
                style={[styles.input, styles.textarea]}
              />

              <TextInput
                value={assignedTo}
                onChangeText={setAssignedTo}
                placeholder="ID du responsable"
                placeholderTextColor="#A3A3A3"
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={styles.label}>Statut</Text>
              <View style={styles.options}>
                {Object.entries(STATUS).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={canEdit ? () => setStatus(value) : undefined}
                    style={[
                      styles.option,
                      status === value && styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        status === value && styles.optionTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Priorité</Text>
              <View style={styles.options}>
                {Object.entries(PRIORITY).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={canEdit ? () => setPriority(value) : undefined}
                    style={[
                      styles.option,
                      priority === value && styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        priority === value && styles.optionTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={dueAt}
                onChangeText={setDueAt}
                placeholder="Échéance : AAAA-MM-JJ"
                placeholderTextColor="#A3A3A3"
                style={styles.input}
              />

              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={styles.cancelButton}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>Annuler</Text>
                </Pressable>

                <Pressable
                  onPress={save}
                  style={styles.saveButton}
                  disabled={saving}
                >
                  <Text style={styles.saveText}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  back: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 34, color: '#171717' },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: '#171717' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#737373' },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#171717',
  },
  addText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#171717',
  },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 15,
  },
  taskTitle: { fontSize: 16, fontWeight: '700', color: '#171717' },
  description: { marginTop: 6, fontSize: 13, color: '#737373' },
  badges: { flexDirection: 'row', gap: 7, marginTop: 10 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F0F0EE',
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#171717' },
  detail: { marginTop: 7, fontSize: 12, color: '#737373' },
  actions: { flexDirection: 'row', marginTop: 13, gap: 10 },
  action: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0EE',
  },
  actionText: { fontSize: 12, color: '#171717', fontWeight: '600' },
  deleteText: { fontSize: 12, color: '#A33A3A', fontWeight: '600' },
  info: { margin: 20, color: '#737373' },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 70 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },
  emptyText: { marginTop: 6, color: '#737373', textAlign: 'center' },
  error: { color: '#A33A3A', textAlign: 'center' },
  retry: {
    marginTop: 14,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#171717',
  },
  retryText: { color: '#FFFFFF', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modal: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#171717',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    color: '#171717',
    backgroundColor: '#F7F7F5',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#525252',
    marginBottom: 7,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#F0F0EE',
  },
  optionSelected: { backgroundColor: '#171717' },
  optionText: { fontSize: 11, color: '#404040', fontWeight: '600' },
  optionTextSelected: { color: '#FFFFFF' },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F0F0EE',
  },
  cancelText: { color: '#171717', fontWeight: '600' },
  saveButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#171717',
  },
  saveText: { color: '#FFFFFF', fontWeight: '600' },
});
