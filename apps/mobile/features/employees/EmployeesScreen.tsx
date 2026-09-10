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
  createEmployee,
  deleteEmployee,
  Employee,
  listEmployees,
  updateEmployee,
} from './employeeService';

import { usePermission } from '../../lib/usePermission';
export default function EmployeesScreen({


  onBack,
}: {
  onBack?: () => void;
}) {
  const { allowed: canView } = usePermission('hr', 'view');
  const { allowed: canCreate } = usePermission('hr', 'create');
  const { allowed: canEdit } = usePermission('hr', 'edit');
  const { allowed: canDelete } = usePermission('hr', 'delete');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setEmployees(await listEmployees());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Impossible de charger les employés.',
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

    loadEmployees();
  }, [loadEmployees]);

  function openCreate() {
    setEditing(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRole('');
    setDepartment('');
    setModalVisible(true);
  }

  function openEdit(employee: Employee) {
    setEditing(employee);
    setFirstName(employee.first_name);
    setLastName(employee.last_name);
    setEmail(employee.email ?? '');
    setPhone(employee.phone ?? '');
    setRole(employee.role ?? '');
    setDepartment(employee.department ?? '');
    setModalVisible(true);
  }

  async function save() {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier employé.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer employé.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(
        'Informations requises',
        'Le prénom et le nom sont obligatoires.',
      );
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        await updateEmployee(editing.id, {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          role,
          department,
        });
      } else {
        await createEmployee({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          role,
          department,
        });
      }

      setModalVisible(false);
      await loadEmployees();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer l’employé.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(employee: Employee) {
    if (!canDelete) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de supprimer employé.');
      return;
    }

    Alert.alert(
      'Supprimer l’employé',
      `Voulez-vous supprimer « ${employee.first_name} ${employee.last_name} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmployee(employee.id);
              await loadEmployees();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error
                  ? e.message
                  : 'Impossible de supprimer l’employé.',
              );
            }
          },
        },
      ],
    );
  }

  const filtered = employees.filter((employee) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      employee.first_name,
      employee.last_name,
      employee.email ?? '',
      employee.phone ?? '',
      employee.role ?? '',
      employee.department ?? '',
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
          <Text style={styles.title}>Employés</Text>
          <Text style={styles.subtitle}>
            {employees.length} employé{employees.length > 1 ? 's' : ''}
          </Text>
        </View>

        {canCreate && <Pressable onPress={openCreate} style={styles.addButton}>
          <Text style={styles.addText}>+ Nouveau</Text>
        </Pressable>}
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher un employé..."
        placeholderTextColor="#A3A3A3"
        style={styles.search}
      />

      {loading ? (
        <Text style={styles.info}>Chargement...</Text>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={loadEmployees} style={styles.retry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {employees.length === 0 ? 'Aucun employé' : 'Aucun résultat'}
          </Text>
          <Text style={styles.emptyText}>
            {employees.length === 0
              ? 'Ajoutez votre premier collaborateur.'
              : 'Modifiez votre recherche.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((employee) => (
            <View key={employee.id} style={styles.card}>
              <Pressable onPress={canEdit ? () => openEdit(employee) : undefined}>
                <Text style={styles.name}>
                  {employee.first_name} {employee.last_name}
                </Text>

                {employee.role ? (
                  <Text style={styles.role}>{employee.role}</Text>
                ) : null}

                {employee.department ? (
                  <Text style={styles.detail}>{employee.department}</Text>
                ) : null}

                {employee.email ? (
                  <Text style={styles.detail}>{employee.email}</Text>
                ) : null}

                {employee.phone ? (
                  <Text style={styles.detail}>{employee.phone}</Text>
                ) : null}
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  onPress={canEdit ? () => openEdit(employee) : undefined}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>Modifier</Text>
                </Pressable>

                {canDelete && (
                  <Pressable
                    onPress={() => confirmDelete(employee)}
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
            <Text style={styles.modalTitle}>
              {editing ? 'Modifier l’employé' : 'Nouvel employé'}
            </Text>

            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Prénom *"
              placeholderTextColor="#A3A3A3"
              style={styles.input}
            />

            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Nom *"
              placeholderTextColor="#A3A3A3"
              style={styles.input}
            />

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#A3A3A3"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Téléphone"
              placeholderTextColor="#A3A3A3"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <TextInput
              value={role}
              onChangeText={setRole}
              placeholder="Fonction / rôle"
              placeholderTextColor="#A3A3A3"
              style={styles.input}
            />

            <TextInput
              value={department}
              onChangeText={setDepartment}
              placeholder="Département"
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 34,
    color: '#171717',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#171717',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#737373',
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#171717',
  },
  addText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
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
  list: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 15,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171717',
  },
  role: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '600',
    color: '#4B6B50',
  },
  detail: {
    marginTop: 4,
    fontSize: 13,
    color: '#737373',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 13,
    gap: 10,
  },
  action: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0EE',
  },
  actionText: {
    fontSize: 12,
    color: '#171717',
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 12,
    color: '#A33A3A',
    fontWeight: '600',
  },
  info: {
    margin: 20,
    color: '#737373',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 70,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#171717',
  },
  emptyText: {
    marginTop: 6,
    color: '#737373',
    textAlign: 'center',
  },
  error: {
    color: '#A33A3A',
    textAlign: 'center',
  },
  retry: {
    marginTop: 14,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#171717',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modal: {
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F0F0EE',
  },
  cancelText: {
    color: '#171717',
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#171717',
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
