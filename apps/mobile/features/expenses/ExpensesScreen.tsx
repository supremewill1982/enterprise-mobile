import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  createExpense,
  deleteExpense,
  Expense,
  listExpenses,
  updateExpense,
} from './expenseService';
import { listSuppliers } from '../suppliers/supplierService';
import { usePermission } from '../../lib/usePermission';

type Supplier = {
  id: string;
  name: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesScreen() {
  const { allowed: canView } = usePermission('finance', 'view');
  const { allowed: canCreate } = usePermission('finance', 'create');
  const { allowed: canEdit } = usePermission('finance', 'edit');
  const { allowed: canDelete } = usePermission('finance', 'delete');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [status, setStatus] = useState('pending');
  const [expenseDate, setExpenseDate] = useState(today());
  const [supplierId, setSupplierId] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [expenseData, supplierData] = await Promise.all([
        listExpenses(),
        listSuppliers(),
      ]);
      setExpenses(expenseData);
      setSuppliers(supplierData as Supplier[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les dépenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;

    return expenses.filter((expense) => {
      const supplier = suppliers.find((s) => s.id === expense.supplier_id);
      return (
        expense.description.toLowerCase().includes(q) ||
        expense.status.toLowerCase().includes(q) ||
        supplier?.name.toLowerCase().includes(q)
      );
    });
  }, [expenses, search, suppliers]);

  const resetForm = () => {
    setEditing(null);
    setDescription('');
    setAmount('');
    setCurrency('XAF');
    setStatus('pending');
    setExpenseDate(today());
    setSupplierId('');
  };

  const openCreate = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setStatus(expense.status);
    setExpenseDate(expense.expense_date);
    setSupplierId(expense.supplier_id ?? '');
    setModalVisible(true);
  };

  const save = async () => {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier dépense.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer dépense.');
      return;
    }

    const parsedAmount = Number(amount.replace(',', '.'));

    if (!description.trim()) {
      Alert.alert('Erreur', 'La description est obligatoire.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      Alert.alert('Erreur', 'Le montant est invalide.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      Alert.alert('Erreur', 'La date doit être au format AAAA-MM-JJ.');
      return;
    }

    try {
      setSaving(true);

      const input = {
        supplier_id: supplierId || null,
        description,
        amount: parsedAmount,
        currency,
        status,
        expense_date: expenseDate,
      };

      if (editing) {
        await updateExpense(editing.id, input);
      } else {
        await createExpense(input);
      }

      setModalVisible(false);
      resetForm();
      await load();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer la dépense',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = (expense: Expense) => {
    Alert.alert(
      'Supprimer la dépense',
      `Supprimer « ${expense.description} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(expense.id);
              await load();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error ? e.message : 'Impossible de supprimer',
              );
            }
          },
        },
      ],
    );
  };

  const supplierName = (id: string | null) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? '';

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dépenses</Text>
          <Text style={styles.subtitle}>
            Suivi des dépenses de l’entreprise
          </Text>
        </View>

        {canCreate && <Pressable style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+ Ajouter</Text>
        </Pressable>}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Rechercher une dépense..."
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <Text style={styles.info}>Chargement...</Text>
      ) : error ? (
        <View>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load}>
            <Text style={styles.retry}>Réessayer</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.info}>Aucune dépense.</Text>
      ) : (
        filtered.map((expense) => (
          <Pressable
            key={expense.id}
            style={styles.card}
            onPress={canEdit ? () => openEdit(expense) : undefined}
          >
            <View style={styles.cardTop}>
              <Text style={styles.description}>{expense.description}</Text>
              <Text style={styles.amount}>
                {Number(expense.amount).toLocaleString('fr-FR')} {expense.currency}
              </Text>
            </View>

            <Text style={styles.meta}>
              {expense.expense_date}
              {supplierName(expense.supplier_id)
                ? ` · ${supplierName(expense.supplier_id)}`
                : ''}
            </Text>

            <View style={styles.cardBottom}>
              <Text style={styles.status}>{expense.status}</Text>
              {canDelete && (
                <Pressable onPress={() => remove(expense)}>
                  <Text style={styles.delete}>Supprimer</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        ))
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitle}>
                {editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </Text>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex. Achat fournitures"
              />

              <Text style={styles.label}>Montant</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0"
              />

              <Text style={styles.label}>Devise</Text>
              <TextInput
                style={styles.input}
                value={currency}
                onChangeText={setCurrency}
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="AAAA-MM-JJ"
              />

              <Text style={styles.label}>Fournisseur</Text>
              <TextInput
                style={styles.input}
                value={supplierId}
                onChangeText={setSupplierId}
                placeholder="UUID du fournisseur (optionnel)"
              />

              <Text style={styles.label}>Statut</Text>
              <View style={styles.options}>
                {['pending', 'approved', 'paid', 'cancelled'].map((value) => (
                  <Pressable
                    key={value}
                    style={[
                      styles.option,
                      status === value && styles.optionActive,
                    ]}
                    onPress={canEdit ? () => setStatus(value) : undefined}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        status === value && styles.optionTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={styles.cancel}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text>Annuler</Text>
                </Pressable>

                <Pressable
                  style={styles.save}
                  onPress={save}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 4, color: '#666' },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  info: { color: '#666', paddingVertical: 20 },
  error: { color: '#b00020', marginBottom: 8 },
  retry: { fontWeight: '600', paddingVertical: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  description: { fontSize: 16, fontWeight: '600', flex: 1 },
  amount: { fontSize: 16, fontWeight: '700' },
  meta: { color: '#777', marginTop: 7 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  status: { fontSize: 12, fontWeight: '600' },
  delete: { color: '#b00020', fontSize: 12, fontWeight: '600' },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
  label: { fontWeight: '600', marginBottom: 7, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionActive: { backgroundColor: '#111', borderColor: '#111' },
  optionText: { fontSize: 13 },
  optionTextActive: { color: '#fff' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
    marginBottom: 10,
  },
  cancel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#eee',
  },
  save: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  saveText: { color: '#fff', fontWeight: '600' },
});
