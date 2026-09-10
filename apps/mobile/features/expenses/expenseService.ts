import { supabase } from '../../lib/supabase';

export type Expense = {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  description: string;
  amount: number;
  currency: string;
  status: string;
  expense_date: string;
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

export async function listExpenses() {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('organization_id', organizationId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function createExpense(input: {
  supplier_id?: string | null;
  description: string;
  amount: number;
  currency?: string;
  status?: string;
  expense_date: string;
}) {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      organization_id: organizationId,
      supplier_id: input.supplier_id || null,
      description: input.description.trim(),
      amount: input.amount,
      currency: input.currency || 'XAF',
      status: input.status || 'pending',
      expense_date: input.expense_date,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(
  id: string,
  input: {
    supplier_id?: string | null;
    description: string;
    amount: number;
    currency?: string;
    status?: string;
    expense_date: string;
  },
) {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .from('expenses')
    .update({
      supplier_id: input.supplier_id || null,
      description: input.description.trim(),
      amount: input.amount,
      currency: input.currency || 'XAF',
      status: input.status || 'pending',
      expense_date: input.expense_date,
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string) {
  const organizationId = await getOrganizationId();

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId);

  if (error) throw error;
}
