import { supabase } from '../../lib/supabase';

export type QuoteItem = {
  id?: string;
  quote_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
};

export type Quote = {
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
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  items: QuoteItem[];
};

async function getOrganizationId() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Utilisateur non authentifié.');

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (error) throw error;

  return data.organization_id as string;
}

export async function listQuotes(): Promise<Quote[]> {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const quotes = (data ?? []) as Omit<Quote, 'items'>[];

  if (!quotes.length) return [];

  const ids = quotes.map((quote) => quote.id);

  const { data: items, error: itemsError } = await supabase
    .from('quote_items')
    .select('*')
    .in('quote_id', ids)
    .order('id');

  if (itemsError) throw itemsError;

  return quotes.map((quote) => ({
    ...quote,
    items: (items ?? []).filter((item) => item.quote_id === quote.id),
  }));
}

export async function createQuote(input: {
  customer_id: string | null;
  number: string;
  status: string;
  currency: string;
  issue_date: string;
  valid_until: string | null;
  items: QuoteItem[];
}) {
  const organizationId = await getOrganizationId();

  const items = input.items.map((item) => ({
    description: item.description.trim(),
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    tax_rate: Number(item.tax_rate) || 0,
    total:
      (Number(item.quantity) || 0) *
      (Number(item.unit_price) || 0),
  }));

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = items.reduce(
    (sum, item) => sum + item.total * (item.tax_rate / 100),
    0,
  );
  const total = subtotal + tax;

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      organization_id: organizationId,
      customer_id: input.customer_id || null,
      number: input.number.trim(),
      status: input.status,
      currency: input.currency.trim() || 'XAF',
      subtotal,
      tax,
      total,
      issue_date: input.issue_date,
      valid_until: input.valid_until || null,
    })
    .select()
    .single();

  if (error) throw error;

  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(
      items.map((item) => ({
        quote_id: quote.id,
        ...item,
      })),
    );

  if (itemsError) {
    await supabase.from('quotes').delete().eq('id', quote.id);
    throw itemsError;
  }

  return quote;
}

export async function updateQuote(
  id: string,
  input: {
    customer_id: string | null;
    number: string;
    status: string;
    currency: string;
    issue_date: string;
    valid_until: string | null;
    items: QuoteItem[];
  },
) {
  const items = input.items.map((item) => ({
    description: item.description.trim(),
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    tax_rate: Number(item.tax_rate) || 0,
    total:
      (Number(item.quantity) || 0) *
      (Number(item.unit_price) || 0),
  }));

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = items.reduce(
    (sum, item) => sum + item.total * (item.tax_rate / 100),
    0,
  );

  const { data: quote, error } = await supabase
    .from('quotes')
    .update({
      customer_id: input.customer_id || null,
      number: input.number.trim(),
      status: input.status,
      currency: input.currency.trim() || 'XAF',
      subtotal,
      tax,
      total: subtotal + tax,
      issue_date: input.issue_date,
      valid_until: input.valid_until || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  const { error: deleteError } = await supabase
    .from('quote_items')
    .delete()
    .eq('quote_id', id);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from('quote_items')
    .insert(
      items.map((item) => ({
        quote_id: id,
        ...item,
      })),
    );

  if (insertError) throw insertError;

  return quote;
}

export async function deleteQuote(id: string) {
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
