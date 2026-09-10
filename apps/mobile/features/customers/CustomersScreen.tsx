import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermission } from '../../lib/usePermission';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createCustomer,
  Customer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from './customerService';

type Props = {
  onBack?: () => void;
};

export default function CustomersScreen({ onBack }: Props) {
  const { allowed: canView } = usePermission('commercial', 'view');
  const { allowed: canCreate } = usePermission('commercial', 'create');
  const { allowed: canEdit } = usePermission('commercial', 'edit');
  const { allowed: canDelete } = usePermission('commercial', 'delete');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setCustomers(await listCustomers());
    } catch (error) {
      Alert.alert(
        'Impossible de charger les clients',
        error instanceof Error ? error.message : 'Une erreur est survenue.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) {
      loadCustomers();
    } else {
      setLoading(false);
    }
  }, [canView, loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) =>
      [
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [customers, search]);

  function openCreate() {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setModalVisible(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setName(customer.name);
    setEmail(customer.email ?? '');
    setPhone(customer.phone ?? '');
    setAddress(customer.address ?? '');
    setModalVisible(true);
  }

  async function save() {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier un client.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer un client.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Nom requis', 'Le nom du client est obligatoire.');
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        await updateCustomer(editing.id, {
          name,
          email,
          phone,
          address,
        });
      } else {
        await createCustomer({
          name,
          email,
          phone,
          address,
        });
      }

      setModalVisible(false);
      await loadCustomers();
    } catch (error) {
      Alert.alert(
        'Enregistrement impossible',
        error instanceof Error ? error.message : 'Une erreur est survenue.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(customer: Customer) {
    if (!canDelete) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de supprimer un client.');
      return;
    }

    Alert.alert(
      'Supprimer le client ?',
      `Le client « ${customer.name} » sera supprimé.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer(customer.id);
              await loadCustomers();
            } catch (error) {
              Alert.alert(
                'Suppression impossible',
                error instanceof Error
                  ? error.message
                  : 'Une erreur est survenue.',
              );
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.back}>
              <Text style={styles.backText}>‹ Activité</Text>
            </Pressable>
          )}
          <Text style={styles.title}>Clients</Text>
          <Text style={styles.subtitle}>
            {customers.length} client{customers.length > 1 ? 's' : ''}
          </Text>
        </View>

        {canCreate && (
          <Pressable onPress={openCreate} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Nouveau</Text>
          </Pressable>
        )}

      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher un client..."
        placeholderTextColor="#A3A3A3"
        style={styles.search}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Chargement des clients...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {filteredCustomers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {search ? 'Aucun résultat' : 'Aucun client'}
              </Text>
              <Text style={styles.emptyText}>
                {search
                  ? 'Essayez une autre recherche.'
                  : 'Ajoutez votre premier client.'}
              </Text>
              {!search && canCreate && (
                <Pressable onPress={openCreate} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>
                    Ajouter un client
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            filteredCustomers.map((customer) => (
              <Pressable
                key={customer.id}
                onPress={canEdit ? () => openEdit(customer) : undefined}
                style={styles.customerCard}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {customer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  {!!customer.email && (
                    <Text style={styles.detail}>{customer.email}</Text>
                  )}
                  {!!customer.phone && (
                    <Text style={styles.detail}>{customer.phone}</Text>
                  )}
                </View>

                {canDelete && (
                  <Pressable
                    onPress={() => confirmDelete(customer)}
                    hitSlop={10}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>Suppr.</Text>
                  </Pressable>
                )}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editing ? 'Modifier le client' : 'Nouveau client'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Informations du client
                </Text>
              </View>

              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Nom *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom du client"
                style={styles.input}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemple.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={styles.label}>Téléphone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+241 ..."
                keyboardType="phone-pad"
                style={styles.input}
              />

              <Text style={styles.label}>Adresse</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Adresse"
                style={[styles.input, styles.multiline]}
                multiline
              />

              <Pressable
                onPress={save}
                disabled={saving}
                style={[styles.saveButton, saving && styles.disabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>
                    {editing ? 'Enregistrer les modifications' : 'Créer le client'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
  },
  back: {
    marginBottom: 8,
  },
  backText: {
    color: '#737373',
    fontSize: 14,
  },
  title: {
    color: '#171717',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#737373',
    marginTop: 3,
    fontSize: 13,
  },
  addButton: {
    backgroundColor: '#171717',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  search: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#171717',
    marginBottom: 12,
  },
  list: {
    paddingBottom: 30,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0F0EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#171717',
    fontWeight: '700',
    fontSize: 16,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    color: '#171717',
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    color: '#737373',
    fontSize: 12,
    marginTop: 3,
  },
  deleteButton: {
    padding: 6,
  },
  deleteText: {
    color: '#A33A3A',
    fontSize: 11,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 10,
    color: '#737373',
    fontSize: 13,
  },
  empty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#171717',
  },
  emptyText: {
    color: '#737373',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 18,
    backgroundColor: '#171717',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#F7F7F5',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    color: '#171717',
    fontSize: 21,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#737373',
    fontSize: 12,
    marginTop: 3,
  },
  close: {
    fontSize: 30,
    color: '#737373',
  },
  label: {
    color: '#404040',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: '#171717',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#171717',
    borderRadius: 11,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 20,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
