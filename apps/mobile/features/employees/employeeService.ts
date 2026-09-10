import { supabase } from '../../lib/supabase';

export type Employee = {
  id: string;
  organization_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
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

export async function listEmployees(): Promise<Employee[]> {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .schema('enterprise')
    .from('employees')
    .select('*')
    .eq('organization_id', organizationId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Employee[];
}

export async function createEmployee(input: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
}): Promise<Employee> {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .schema('enterprise')
    .from('employees')
    .insert({
      organization_id: organizationId,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      role: input.role?.trim() || null,
      department: input.department?.trim() || null,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(
  id: string,
  input: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    role?: string;
    department?: string;
  },
): Promise<Employee> {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('employees')
    .update({
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      role: input.role?.trim() || null,
      department: input.department?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await supabase
    .schema('enterprise')
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
