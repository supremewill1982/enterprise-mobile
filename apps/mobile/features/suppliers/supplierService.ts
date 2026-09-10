import { supabase } from '../../lib/supabase';

export type Supplier = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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

export async function listSuppliers(): Promise<Supplier[]> {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .schema('enterprise')
    .from('suppliers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function createSupplier(input: {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<Supplier> {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .schema('enterprise')
    .from('suppliers')
    .insert({
      organization_id: organizationId,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Supplier;
}

export async function updateSupplier(
  id: string,
  input: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  },
): Promise<Supplier> {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('suppliers')
    .update({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .schema('enterprise')
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
