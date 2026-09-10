import { supabase } from '../../lib/supabase';

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
};

export type Invoice = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  number: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  issue_date: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
};

export type InvoiceInput = {
  customer_id?: string | null;
  number: string;
  status?: string;
  currency?: string;
  issue_date: string;
  due_date?: string | null;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }[];
};

async function getOrganizationId(): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('Utilisateur non authentifié.');

  const { data, error } = await supabase
    .schema('enterprise')
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.organization_id) {
    throw new Error('Aucune organisation associée à cet utilisateur.');
  }

  return data.organization_id;
}

function calculateItems(items: InvoiceInput['items']) {
  return items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const taxRate = Number(item.tax_rate) || 0;

    const total = quantity * unitPrice;
    const tax = total * (taxRate / 100);

    return {
      ...item,
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
      total: Math.round(total * 100) / 100,
      taxAmount: Math.round(tax * 100) / 100,
    };
  });
}

export async function listInvoices(): Promise<Invoice[]> {
  const organizationId = await getOrganizationId();

  const { data: invoices, error } = await supabase
    .schema('enterprise')
    .from('invoices')
    .select('*')
    .eq('organization_id', organizationId)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  const ids = (invoices ?? []).map((invoice) => invoice.id);

  if (!ids.length) return [];

  const { data: items, error: itemsError } = await supabase
    .schema('enterprise')
    .from('invoice_items')
    .select('*')
    .in('invoice_id', ids);

  if (itemsError) throw itemsError;

  return (invoices ?? []).map((invoice) => ({
    ...invoice,
    items: (items ?? []).filter((item) => item.invoice_id === invoice.id),
  })) as Invoice[];
}

export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const organizationId = await getOrganizationId();

  if (!input.number.trim()) {
    throw new Error('Le numéro de facture est obligatoire.');
  }

  if (!input.items.length) {
    throw new Error('La facture doit contenir au moins une ligne.');
  }

  const calculated = calculateItems(input.items);
  const subtotal = calculated.reduce((sum, item) => sum + item.total, 0);
  const tax = calculated.reduce((sum, item) => sum + item.taxAmount, 0);
  const total = subtotal + tax;

  const { data: invoice, error } = await supabase
    .schema('enterprise')
    .from('invoices')
    .insert({
      organization_id: organizationId,
      customer_id: input.customer_id || null,
      number: input.number.trim(),
      status: input.status || 'draft',
      currency: input.currency || 'XAF',
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
      issue_date: input.issue_date,
      due_date: input.due_date || null,
    })
    .select('*')
    .single();

  if (error) throw error;

  const { data: items, error: itemsError } = await supabase
    .schema('enterprise')
    .from('invoice_items')
    .insert(
      calculated.map((item) => ({
        invoice_id: invoice.id,
        description: item.description.trim(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total: item.total,
      })),
    )
    .select('*');

  if (itemsError) {
    await supabase.schema('enterprise').from('invoices').delete().eq('id', invoice.id);
    throw itemsError;
  }

  return {
    ...invoice,
    items: (items ?? []) as InvoiceItem[],
  } as Invoice;
}

export async function updateInvoice(
  id: string,
  input: InvoiceInput,
): Promise<Invoice> {
  if (!input.number.trim()) {
    throw new Error('Le numéro de facture est obligatoire.');
  }

  if (!input.items.length) {
    throw new Error('La facture doit contenir au moins une ligne.');
  }

  const calculated = calculateItems(input.items);
  const subtotal = calculated.reduce((sum, item) => sum + item.total, 0);
  const tax = calculated.reduce((sum, item) => sum + item.taxAmount, 0);
  const total = subtotal + tax;

  const { data: invoice, error } = await supabase
    .schema('enterprise')
    .from('invoices')
    .update({
      customer_id: input.customer_id || null,
      number: input.number.trim(),
      status: input.status || 'draft',
      currency: input.currency || 'XAF',
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
      issue_date: input.issue_date,
      due_date: input.due_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  const { error: deleteError } = await supabase
    .schema('enterprise')
    .from('invoice_items')
    .delete()
    .eq('invoice_id', id);

  if (deleteError) throw deleteError;

  const { data: items, error: itemsError } = await supabase
    .schema('enterprise')
    .from('invoice_items')
    .insert(
      calculated.map((item) => ({
        invoice_id: id,
        description: item.description.trim(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total: item.total,
      })),
    )
    .select('*');

  if (itemsError) throw itemsError;

  return {
    ...invoice,
    items: (items ?? []) as InvoiceItem[],
  } as Invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .schema('enterprise')
    .from('invoices')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
