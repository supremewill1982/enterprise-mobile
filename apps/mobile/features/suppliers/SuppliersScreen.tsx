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
  createSupplier,
  deleteSupplier,
  listSuppliers,
  Supplier,
  updateSupplier,
} from './supplierService';

import { usePermission } from '../../lib/usePermission';
export default function SuppliersScreen({


  onBack,
}: {
  onBack?: () => void;
}) {
  const { allowed: canView } = usePermission('commercial', 'view');
  const { allowed: canCreate } = usePermission('commercial', 'create');
  const { allowed: canEdit } = usePermission('commercial', 'edit');
  const { allowed: canDelete } = usePermission('commercial', 'delete');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSuppliers(await listSuppliers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les fournisseurs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    loadSuppliers();
  }, [loadSuppliers]);

  function openCreate() {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setModalVisible(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setName(supplier.name);
    setEmail(supplier.email ?? '');
    setPhone(supplier.phone ?? '');
    setAddress(supplier.address ?? '');
    setModalVisible(true);
  }

  async function save() {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier fournisseur.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer fournisseur.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Nom requis', 'Veuillez renseigner le nom du fournisseur.');
      return;
    }

    try {
      setSaving(true);

      if (editing) {
        await updateSupplier(editing.id, {
          name,
          email,
          phone,
          address,
        });
      } else {
        await createSupplier({
          name,
          email,
          phone,
          address,
        });
      }

      setModalVisible(false);
      await loadSuppliers();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer le fournisseur.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(supplier: Supplier) {
    if (!canDelete) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de supprimer fournisseur.');
      return;
    }

    Alert.alert(
      'Supprimer le fournisseur',
      `Voulez-vous supprimer « ${supplier.name} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSupplier(supplier.id);
              await loadSuppliers();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error ? e.message : 'Impossible de supprimer le fournisseur.',
              );
            }
          },
        },
      ],
    );
  }

  const filtered = suppliers.filter((supplier) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      supplier.name,
      supplier.email ?? '',
      supplier.phone ?? '',
      supplier.address ?? '',
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
          <Text style={styles.title}>Fournisseurs</Text>
          <Text style={styles.subtitle}>
            {suppliers.length} fournisseur{suppliers.length > 1 ? 's' : ''}
          </Text>
        </View>

        {canCreate && <Pressable onPress={openCreate} style={styles.addButton}>
          <Text style={styles.addText}>+ Nouveau</Text>
        </Pressable>}
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher un fournisseur..."
        placeholderTextColor="#A3A3A3"
        style={styles.search}
      />

      {loading ? (
        <Text style={styles.info}>Chargement...</Text>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={loadSuppliers} style={styles.retry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {suppliers.length === 0
              ? 'Aucun fournisseur'
              : 'Aucun résultat'}
          </Text>
          <Text style={styles.emptyText}>
            {suppliers.length === 0
              ? 'Ajoutez votre premier fournisseur.'
              : 'Modifiez votre recherche.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((supplier) => (
            <View key={supplier.id} style={styles.card}>
              <Pressable onPress={canEdit ? () => openEdit(supplier) : undefined}>
                <Text style={styles.name}>{supplier.name}</Text>

                {supplier.email ? (
                  <Text style={styles.detail}>{supplier.email}</Text>
                ) : null}

                {supplier.phone ? (
                  <Text style={styles.detail}>{supplier.phone}</Text>
                ) : null}

                {supplier.address ? (
                  <Text style={styles.detail}>{supplier.address}</Text>
                ) : null}
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  onPress={canEdit ? () => openEdit(supplier) : undefined}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>Modifier</Text>
                </Pressable>

                {canDelete && (
                  <Pressable
                    onPress={() => confirmDelete(supplier)}
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
              {editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
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
              value={address}
              onChangeText={setAddress}
              placeholder="Adresse"
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
