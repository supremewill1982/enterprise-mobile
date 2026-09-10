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
  createInvoice,
  deleteInvoice,
  Invoice,
  InvoiceInput,
  listInvoices,
  updateInvoice,
} from './invoiceService';
import { listCustomers, Customer } from '../customers/customerService';
import { usePermission } from '../../lib/usePermission';

const STATUS = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
} as const;

type DraftItem = {
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

const emptyItem = (): DraftItem => ({
  description: '',
  quantity: '1',
  unit_price: '0',
  tax_rate: '0',
});

export default function InvoicesScreen({


  onBack,
}: {
  onBack?: () => void;
}) {
  const { allowed: canView } = usePermission('finance', 'view');
  const { allowed: canCreate } = usePermission('finance', 'create');
  const { allowed: canEdit } = usePermission('finance', 'edit');
  const { allowed: canDelete } = usePermission('finance', 'delete');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const [number, setNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('draft');
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [invoiceData, customerData] = await Promise.all([
        listInvoices(),
        listCustomers(),
      ]);
      setInvoices(invoiceData);
      setCustomers(customerData);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Impossible de charger les factures.',
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

    loadData();
  }, [loadData]);

  function resetForm() {
    setNumber('');
    setCustomerId('');
    setStatus('draft');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setItems([emptyItem()]);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setModalVisible(true);
  }

  function openEdit(invoice: Invoice) {
    setEditing(invoice);
    setNumber(invoice.number);
    setCustomerId(invoice.customer_id ?? '');
    setStatus(invoice.status);
    setIssueDate(invoice.issue_date);
    setDueDate(invoice.due_date ?? '');

    setItems(
      invoice.items.length
        ? invoice.items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit_price: String(item.unit_price),
            tax_rate: String(item.tax_rate),
          }))
        : [emptyItem()],
    );

    setModalVisible(true);
  }

  function updateItem(
    index: number,
    field: keyof DraftItem,
    value: string,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier facture.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer facture.');
      return;
    }

    if (!number.trim()) {
      Alert.alert('Informations requises', 'Le numéro de facture est obligatoire.');
      return;
    }

    if (!issueDate.trim()) {
      Alert.alert('Informations requises', 'La date d’émission est obligatoire.');
      return;
    }

    const validItems = items.filter((item) => item.description.trim());

    if (!validItems.length) {
      Alert.alert(
        'Lignes requises',
        'Ajoutez au moins une ligne avec une description.',
      );
      return;
    }

    const input: InvoiceInput = {
      customer_id: customerId || null,
      number,
      status,
      currency: 'XAF',
      issue_date: issueDate,
      due_date: dueDate.trim() || null,
      items: validItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        tax_rate: Number(item.tax_rate) || 0,
      })),
    };

    try {
      setSaving(true);

      if (editing) {
        await updateInvoice(editing.id, input);
      } else {
        await createInvoice(input);
      }

      setModalVisible(false);
      await loadData();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer la facture.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(invoice: Invoice) {
    if (!canDelete) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de supprimer facture.');
      return;
    }

    Alert.alert(
      'Supprimer la facture',
      `Voulez-vous supprimer « ${invoice.number} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvoice(invoice.id);
              await loadData();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error
                  ? e.message
                  : 'Impossible de supprimer la facture.',
              );
            }
          },
        },
      ],
    );
  }

  const filtered = invoices.filter((invoice) => {
    const customer = customers.find((c) => c.id === invoice.customer_id);
    const customerName = customer
      ? `${customer.name} ${customer.email ?? ''}`
      : '';

    const q = search.trim().toLowerCase();
    if (!q) return true;

    return `${invoice.number} ${invoice.status} ${customerName}`
      .toLowerCase()
      .includes(q);
  });

  function customerName(id: string | null) {
    if (!id) return 'Aucun client';
    return customers.find((customer) => customer.id === id)?.name ?? 'Client';
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Factures</Text>
          <Text style={styles.subtitle}>
            {invoices.length} facture{invoices.length > 1 ? 's' : ''}
          </Text>
        </View>

        {canCreate && <Pressable onPress={openCreate} style={styles.addButton}>
          <Text style={styles.addText}>+ Nouvelle</Text>
        </Pressable>}
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher une facture..."
        placeholderTextColor="#A3A3A3"
        style={styles.search}
      />

      {loading ? (
        <Text style={styles.info}>Chargement...</Text>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {invoices.length === 0 ? 'Aucune facture' : 'Aucun résultat'}
          </Text>
          <Text style={styles.emptyText}>
            {invoices.length === 0
              ? 'Créez votre première facture.'
              : 'Modifiez votre recherche.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filtered.map((invoice) => (
            <View key={invoice.id} style={styles.card}>
              <Pressable onPress={canEdit ? () => openEdit(invoice) : undefined}>
                <View style={styles.row}>
                  <Text style={styles.invoiceNumber}>{invoice.number}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {STATUS[invoice.status as keyof typeof STATUS] ??
                        invoice.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.customer}>
                  {customerName(invoice.customer_id)}
                </Text>

                <Text style={styles.total}>
                  {Number(invoice.total).toLocaleString('fr-FR')} {invoice.currency}
                </Text>

                <Text style={styles.detail}>
                  Émission :{' '}
                  {new Date(invoice.issue_date).toLocaleDateString('fr-FR')}
                  {invoice.due_date
                    ? ` • Échéance : ${new Date(
                        invoice.due_date,
                      ).toLocaleDateString('fr-FR')}`
                    : ''}
                </Text>
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  onPress={canEdit ? () => openEdit(invoice) : undefined}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>Modifier</Text>
                </Pressable>

                {canDelete && (
                  <Pressable
                    onPress={() => confirmDelete(invoice)}
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
                {editing ? 'Modifier la facture' : 'Nouvelle facture'}
              </Text>

              <TextInput
                value={number}
                onChangeText={setNumber}
                placeholder="Numéro de facture *"
                placeholderTextColor="#A3A3A3"
                style={styles.input}
              />

              <Text style={styles.label}>Client</Text>
              <View style={styles.options}>
                <Pressable
                  onPress={() => setCustomerId('')}
                  style={[
                    styles.option,
                    !customerId && styles.optionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      !customerId && styles.optionTextSelected,
                    ]}
                  >
                    Aucun
                  </Text>
                </Pressable>

                {customers.map((customer) => (
                  <Pressable
                    key={customer.id}
                    onPress={() => setCustomerId(customer.id)}
                    style={[
                      styles.option,
                      customerId === customer.id && styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        customerId === customer.id &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {customer.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

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

              <TextInput
                value={issueDate}
                onChangeText={setIssueDate}
                placeholder="Date d’émission : AAAA-MM-JJ"
                placeholderTextColor="#A3A3A3"
                style={styles.input}
              />

              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="Date d’échéance : AAAA-MM-JJ"
                placeholderTextColor="#A3A3A3"
                style={styles.input}
              />

              <Text style={styles.sectionTitle}>Lignes de facture</Text>

              {items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>Ligne {index + 1}</Text>
                    {items.length > 1 ? (
                      <Pressable onPress={canEdit ? () => removeItem(index) : undefined}>
                        <Text style={styles.deleteText}>Supprimer</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <TextInput
                    value={item.description}
                    onChangeText={(value) =>
                      updateItem(index, 'description', value)
                    }
                    placeholder="Description *"
                    placeholderTextColor="#A3A3A3"
                    style={styles.input}
                  />

                  <View style={styles.twoColumns}>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(value) =>
                        updateItem(index, 'quantity', value)
                      }
                      placeholder="Quantité"
                      placeholderTextColor="#A3A3A3"
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.column]}
                    />

                    <TextInput
                      value={item.unit_price}
                      onChangeText={(value) =>
                        updateItem(index, 'unit_price', value)
                      }
                      placeholder="Prix unitaire"
                      placeholderTextColor="#A3A3A3"
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.column]}
                    />
                  </View>

                  <TextInput
                    value={item.tax_rate}
                    onChangeText={(value) =>
                      updateItem(index, 'tax_rate', value)
                    }
                    placeholder="TVA (%)"
                    placeholderTextColor="#A3A3A3"
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />
                </View>
              ))}

              <Pressable
                onPress={canEdit ? addItem : undefined}
                style={styles.addLine}
              >
                <Text style={styles.addLineText}>+ Ajouter une ligne</Text>
              </Pressable>

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171717',
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F0F0EE',
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#171717' },
  customer: { marginTop: 8, fontSize: 13, color: '#525252' },
  total: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#171717',
  },
  detail: { marginTop: 5, fontSize: 12, color: '#737373' },
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
    maxHeight: '94%',
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#525252',
    marginBottom: 7,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#F0F0EE',
  },
  optionSelected: { backgroundColor: '#171717' },
  optionText: { fontSize: 11, color: '#404040', fontWeight: '600' },
  optionTextSelected: { color: '#FFFFFF' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171717',
    marginTop: 8,
    marginBottom: 10,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemTitle: { fontSize: 13, fontWeight: '700', color: '#171717' },
  twoColumns: { flexDirection: 'row', gap: 8 },
  column: { flex: 1 },
  addLine: {
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F0F0EE',
    alignItems: 'center',
    marginBottom: 10,
  },
  addLineText: { fontSize: 13, fontWeight: '600', color: '#171717' },
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
