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
  createPayment,
  deletePayment,
  listPayments,
  Payment,
  updatePayment,
} from './paymentService';
import { listInvoices } from '../invoices/invoiceService';
import { usePermission } from '../../lib/usePermission';

type Invoice = {
  id: string;
  number: string;
  total: number;
  currency: string;
};

export default function PaymentsScreen() {
  const { allowed: canView } = usePermission('finance', 'view');
  const { allowed: canCreate } = usePermission('finance', 'create');
  const { allowed: canEdit } = usePermission('finance', 'edit');
  const { allowed: canDelete } = usePermission('finance', 'delete');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString());
  const [invoiceId, setInvoiceId] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [paymentData, invoiceData] = await Promise.all([
        listPayments(),
        listInvoices(),
      ]);

      setPayments(paymentData);
      setInvoices(invoiceData as Invoice[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Impossible de charger les paiements',
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

    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;

    return payments.filter((payment) => {
      const invoice = invoices.find((i) => i.id === payment.invoice_id);

      return (
        payment.currency.toLowerCase().includes(q) ||
        payment.payment_method?.toLowerCase().includes(q) ||
        invoice?.number.toLowerCase().includes(q)
      );
    });
  }, [payments, invoices, search]);

  const resetForm = () => {
    setEditing(null);
    setAmount('');
    setCurrency('XAF');
    setPaymentMethod('');
    setPaidAt(new Date().toISOString());
    setInvoiceId('');
  };

  const openCreate = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (payment: Payment) => {
    setEditing(payment);
    setAmount(String(payment.amount));
    setCurrency(payment.currency);
    setPaymentMethod(payment.payment_method ?? '');
    setPaidAt(payment.paid_at);
    setInvoiceId(payment.invoice_id ?? '');
    setModalVisible(true);
  };

  const save = async () => {
    if (editing && !canEdit) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de modifier paiement.');
      return;
    }

    if (!editing && !canCreate) {
      Alert.alert('Accès refusé', 'Vous n’avez pas la permission de créer paiement.');
      return;
    }

    const parsedAmount = Number(amount.replace(',', '.'));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Erreur', 'Le montant doit être supérieur à zéro.');
      return;
    }

    if (!paidAt.trim()) {
      Alert.alert('Erreur', 'La date du paiement est obligatoire.');
      return;
    }

    try {
      setSaving(true);

      const input = {
        invoice_id: invoiceId || null,
        amount: parsedAmount,
        currency: currency.trim() || 'XAF',
        payment_method: paymentMethod.trim() || null,
        paid_at: paidAt.trim(),
      };

      if (editing) {
        await updatePayment(editing.id, input);
      } else {
        await createPayment(input);
      }

      setModalVisible(false);
      resetForm();
      await load();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer le paiement',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = (payment: Payment) => {
    Alert.alert('Supprimer le paiement', 'Cette opération est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePayment(payment.id);
            await load();
          } catch (e) {
            Alert.alert(
              'Erreur',
              e instanceof Error ? e.message : 'Impossible de supprimer',
            );
          }
        },
      },
    ]);
  };

  const invoiceNumber = (id: string | null) =>
    invoices.find((invoice) => invoice.id === id)?.number ?? '';

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Paiements</Text>
          <Text style={styles.subtitle}>Encaissements enregistrés</Text>
        </View>

        {canCreate && <Pressable style={styles.addButton} onPress={openCreate}>
          <Text style={styles.addButtonText}>+ Ajouter</Text>
        </Pressable>}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Rechercher un paiement..."
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
        <Text style={styles.info}>Aucun paiement.</Text>
      ) : (
        filtered.map((payment) => (
          <Pressable
            key={payment.id}
            style={styles.card}
            onPress={canEdit ? () => openEdit(payment) : undefined}
          >
            <View style={styles.cardTop}>
              <Text style={styles.amount}>
                {Number(payment.amount).toLocaleString('fr-FR')} {payment.currency}
              </Text>
              <Text style={styles.method}>
                {payment.payment_method || 'Méthode non précisée'}
              </Text>
            </View>

            <Text style={styles.meta}>
              {new Date(payment.paid_at).toLocaleString('fr-FR')}
              {invoiceNumber(payment.invoice_id)
                ? ` · Facture ${invoiceNumber(payment.invoice_id)}`
                : ''}
            </Text>

            {canDelete && (
              <Pressable onPress={() => remove(payment)}>
                <Text style={styles.delete}>Supprimer</Text>
              </Pressable>
            )}
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
                {editing ? 'Modifier le paiement' : 'Nouveau paiement'}
              </Text>

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

              <Text style={styles.label}>Méthode de paiement</Text>
              <TextInput
                style={styles.input}
                value={paymentMethod}
                onChangeText={setPaymentMethod}
                placeholder="Ex. Espèces, virement, mobile money"
              />

              <Text style={styles.label}>Date / heure</Text>
              <TextInput
                style={styles.input}
                value={paidAt}
                onChangeText={setPaidAt}
                placeholder="AAAA-MM-JJTHH:MM:SS"
              />

              <Text style={styles.label}>Facture liée</Text>
              <TextInput
                style={styles.input}
                value={invoiceId}
                onChangeText={setInvoiceId}
                placeholder="UUID de la facture (optionnel)"
              />

              <View style={styles.invoiceList}>
                {invoices.slice(0, 8).map((invoice) => (
                  <Pressable
                    key={invoice.id}
                    style={[
                      styles.invoiceOption,
                      invoiceId === invoice.id && styles.invoiceOptionActive,
                    ]}
                    onPress={() => setInvoiceId(invoice.id)}
                  >
                    <Text
                      style={[
                        styles.invoiceText,
                        invoiceId === invoice.id &&
                          styles.invoiceTextActive,
                      ]}
                    >
                      {invoice.number} ·{' '}
                      {Number(invoice.total).toLocaleString('fr-FR')}{' '}
                      {invoice.currency}
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
  amount: { fontSize: 17, fontWeight: '700' },
  method: { color: '#555', flex: 1, textAlign: 'right' },
  meta: { color: '#777', marginTop: 7 },
  delete: {
    color: '#b00020',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
  },
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
  invoiceList: { marginTop: 10, gap: 7 },
  invoiceOption: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 11,
  },
  invoiceOptionActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  invoiceText: { fontSize: 13 },
  invoiceTextActive: { color: '#fff' },
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
