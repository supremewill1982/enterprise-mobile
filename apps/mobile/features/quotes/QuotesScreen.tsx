import React, { useEffect, useMemo, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import {
  createQuote,
  deleteQuote,
  listQuotes,
  updateQuote,
  type Quote,
  type QuoteItem,
} from './quoteService';

type Customer = {
  id: string;
  name: string;
};

const emptyItem = (): QuoteItem => ({
  description: '',
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  total: 0,
});

import { usePermission } from '../../lib/usePermission';
export default function QuotesScreen() {
  const { allowed: canView } = usePermission('finance', 'view');
  const { allowed: canCreate } = usePermission('finance', 'create');
  const { allowed: canEdit } = usePermission('finance', 'edit');
  const { allowed: canDelete } = usePermission('finance', 'delete');

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);

  const [number, setNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState('draft');
  const [currency, setCurrency] = useState('XAF');
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);

  async function load() {
    try {
      setLoading(true);

      const [quoteData, customerData] = await Promise.all([
        listQuotes(),
        supabase.from('customers').select('id,name').order('name'),
      ]);

      if (customerData.error) throw customerData.error;

      setQuotes(quoteData);
      setCustomers(customerData.data ?? []);
    } catch (error: any) {
      Alert.alert('Erreur', error?.message ?? 'Impossible de charger les devis.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    load();
  }, []);

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return quotes;

    return quotes.filter((quote) => {
      const customer = customers.find((item) => item.id === quote.customer_id);
      return (
        quote.number.toLowerCase().includes(query) ||
        quote.status.toLowerCase().includes(query) ||
        customer?.name.toLowerCase().includes(query)
      );
    });
  }, [quotes, customers, search]);

  function openCreate() {
    setEditing(null);
    setNumber(`DEV-${Date.now().toString().slice(-6)}`);
    setCustomerId('');
    setStatus('draft');
    setCurrency('XAF');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setValidUntil('');
    setItems([emptyItem()]);
    setModalVisible(true);
  }

  function openEdit(quote: Quote) {
    setEditing(quote);
    setNumber(quote.number);
    setCustomerId(quote.customer_id ?? '');
    setStatus(quote.status);
    setCurrency(quote.currency);
    setIssueDate(quote.issue_date);
    setValidUntil(quote.valid_until ?? '');
    setItems(quote.items.length ? quote.items : [emptyItem()]);
    setModalVisible(true);
  }

  function updateItem(index: number, field: keyof QuoteItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const next = { ...item };

        if (field === 'description') {
          next.description = value;
        } else if (field === 'quantity') {
          next.quantity = Number(value) || 0;
        } else if (field === 'unit_price') {
          next.unit_price = Number(value) || 0;
        } else if (field === 'tax_rate') {
          next.tax_rate = Number(value) || 0;
        }

        next.total = next.quantity * next.unit_price;
        return next;
      }),
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  );

  const tax = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unit_price * (item.tax_rate / 100),
    0,
  );

  const total = subtotal + tax;

  async function save() {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier devis.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer devis.');
      return;
    }

    if (!number.trim()) {
      Alert.alert('Champ requis', 'Le numéro du devis est obligatoire.');
      return;
    }

    const validItems = items.filter(
      (item) => item.description.trim() && item.quantity > 0,
    );

    if (!validItems.length) {
      Alert.alert('Lignes du devis', 'Ajoutez au moins une ligne valide.');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        customer_id: customerId || null,
        number,
        status,
        currency,
        issue_date: issueDate,
        valid_until: validUntil || null,
        items: validItems,
      };

      if (editing) {
        await updateQuote(editing.id, payload);
      } else {
        await createQuote(payload);
      }

      setModalVisible(false);
      await load();
    } catch (error: any) {
      Alert.alert('Erreur', error?.message ?? 'Impossible d’enregistrer le devis.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(quote: Quote) {
    if (!canDelete) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de supprimer devis.');
      return;
    }

    Alert.alert(
      'Supprimer le devis',
      `Supprimer ${quote.number} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteQuote(quote.id);
              await load();
            } catch (error: any) {
              Alert.alert('Erreur', error?.message ?? 'Suppression impossible.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Devis</Text>
          <Text style={styles.subtitle}>
            {quotes.length} devis
          </Text>
        </View>

        {canCreate && <Pressable style={styles.primaryButton} onPress={openCreate}>
          <Text style={styles.primaryButtonText}>+ Nouveau</Text>
        </Pressable>}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Rechercher un devis..."
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <Text style={styles.info}>Chargement...</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {!filteredQuotes.length ? (
            <Text style={styles.info}>Aucun devis.</Text>
          ) : (
            filteredQuotes.map((quote) => {
              const customer = customers.find(
                (item) => item.id === quote.customer_id,
              );

              return (
                <View key={quote.id} style={styles.card}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.number}>{quote.number}</Text>
                      <Text style={styles.customer}>
                        {customer?.name ?? 'Client non renseigné'}
                      </Text>
                    </View>

                    <Text style={styles.total}>
                      {Number(quote.total).toLocaleString('fr-FR')} {quote.currency}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.badge}>{quote.status}</Text>
                    <Text style={styles.date}>{quote.issue_date}</Text>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={canEdit ? () => openEdit(quote) : undefined}
                    >
                      <Text>Modifier</Text>
                    </Pressable>

                    {canDelete && (
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => confirmDelete(quote)}
                      >
                        <Text style={styles.deleteText}>Supprimer</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.title}>
              {editing ? 'Modifier le devis' : 'Nouveau devis'}
            </Text>

            <Pressable onPress={() => setModalVisible(false)}>
              <Text style={styles.close}>Fermer</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Numéro</Text>
          <TextInput style={styles.input} value={number} onChangeText={setNumber} />

          <Text style={styles.label}>Client</Text>
          <View style={styles.customerList}>
            <Pressable
              style={[
                styles.customerOption,
                !customerId && styles.customerOptionSelected,
              ]}
              onPress={() => setCustomerId('')}
            >
              <Text>Aucun client</Text>
            </Pressable>

            {customers.map((customer) => (
              <Pressable
                key={customer.id}
                style={[
                  styles.customerOption,
                  customerId === customer.id && styles.customerOptionSelected,
                ]}
                onPress={() => setCustomerId(customer.id)}
              >
                <Text>{customer.name}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Statut</Text>
          <View style={styles.statusRow}>
            {['draft', 'sent', 'accepted', 'rejected', 'expired'].map(
              (value) => (
                <Pressable
                  key={value}
                  style={[
                    styles.statusOption,
                    status === value && styles.statusSelected,
                  ]}
                  onPress={canEdit ? () => setStatus(value) : undefined}
                >
                  <Text>{value}</Text>
                </Pressable>
              ),
            )}
          </View>

          <Text style={styles.label}>Date du devis</Text>
          <TextInput
            style={styles.input}
            value={issueDate}
            onChangeText={setIssueDate}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Valable jusqu’au</Text>
          <TextInput
            style={styles.input}
            value={validUntil}
            onChangeText={setValidUntil}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.sectionTitle}>Lignes du devis</Text>

          {items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <TextInput
                style={styles.input}
                placeholder="Description"
                value={item.description}
                onChangeText={(value) =>
                  updateItem(index, 'description', value)
                }
              />

              <View style={styles.inline}>
                <TextInput
                  style={styles.smallInput}
                  placeholder="Qté"
                  keyboardType="decimal-pad"
                  value={String(item.quantity)}
                  onChangeText={(value) =>
                    updateItem(index, 'quantity', value)
                  }
                />

                <TextInput
                  style={styles.smallInput}
                  placeholder="Prix"
                  keyboardType="decimal-pad"
                  value={String(item.unit_price)}
                  onChangeText={(value) =>
                    updateItem(index, 'unit_price', value)
                  }
                />

                <TextInput
                  style={styles.smallInput}
                  placeholder="Taxe %"
                  keyboardType="decimal-pad"
                  value={String(item.tax_rate)}
                  onChangeText={(value) =>
                    updateItem(index, 'tax_rate', value)
                  }
                />
              </View>

              {items.length > 1 && (
                <Pressable
                  onPress={() =>
                    setItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Text style={styles.deleteText}>Retirer cette ligne</Text>
                </Pressable>
              )}
            </View>
          ))}

          <Pressable
            style={styles.secondaryButton}
            onPress={canEdit ? () => setItems((current) => [...current, emptyItem()]) : undefined}
          >
            <Text>+ Ajouter une ligne</Text>
          </Pressable>

          <View style={styles.summary}>
            <Text>Sous-total : {subtotal.toLocaleString('fr-FR')} {currency}</Text>
            <Text>Taxes : {tax.toLocaleString('fr-FR')} {currency}</Text>
            <Text style={styles.grandTotal}>
              Total : {total.toLocaleString('fr-FR')} {currency}
            </Text>
          </View>

          <Pressable
            style={styles.saveButton}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveText}>
              {saving ? 'Enregistrement...' : 'Enregistrer le devis'}
            </Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 4, color: '#666' },
  close: { fontWeight: '600' },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  list: { paddingBottom: 40 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  number: { fontSize: 17, fontWeight: '700' },
  customer: { color: '#666', marginTop: 4 },
  total: { fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  badge: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
  },
  date: { color: '#666' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 9,
    padding: 10,
    alignItems: 'center',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#e0b4b4',
    borderRadius: 9,
    padding: 10,
  },
  deleteText: { color: '#b00020', fontWeight: '600' },
  info: { textAlign: 'center', color: '#666', marginTop: 30 },
  modal: { padding: 20, paddingBottom: 50 },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 9,
    padding: 12,
    marginBottom: 8,
  },
  customerList: { gap: 6 },
  customerOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 9,
    padding: 11,
  },
  customerOptionSelected: {
    borderColor: '#111',
    backgroundColor: '#f2f2f2',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusSelected: {
    borderColor: '#111',
    backgroundColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 10,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  inline: { flexDirection: 'row', gap: 8 },
  smallInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
  },
  summary: {
    marginTop: 20,
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  grandTotal: { fontSize: 18, fontWeight: '700' },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
});
