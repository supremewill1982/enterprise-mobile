import { supabase } from '../../lib/supabase';

export type Payment = {
  id: string;
  organization_id: string;
  invoice_id: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  paid_at: string;
  created_at: string;
};

async function getOrganizationId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non connecté');

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (error) throw error;
  return data.organization_id;
}

export async function listPayments() {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('organization_id', organizationId)
    .order('paid_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Payment[];
}

export async function createPayment(input: {
  invoice_id?: string | null;
  amount: number;
  currency?: string;
  payment_method?: string | null;
  paid_at?: string;
}) {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .from('payments')
    .insert({
      organization_id: organizationId,
      invoice_id: input.invoice_id || null,
      amount: input.amount,
      currency: input.currency || 'XAF',
      payment_method: input.payment_method || null,
      paid_at: input.paid_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as Payment;
}

export async function updatePayment(
  id: string,
  input: {
    invoice_id?: string | null;
    amount: number;
    currency?: string;
    payment_method?: string | null;
    paid_at: string;
  },
) {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .from('payments')
    .update({
      invoice_id: input.invoice_id || null,
      amount: input.amount,
      currency: input.currency || 'XAF',
      payment_method: input.payment_method || null,
      paid_at: input.paid_at,
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw error;
  return data as Payment;
}

export async function deletePayment(id: string) {
  const organizationId = await getOrganizationId();

  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) throw error;
}
