import { supabase } from '../../lib/supabase';

export type Task = {
  id: string;
  organization_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
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

export async function listTasks(): Promise<Task[]> {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .schema('enterprise')
    .from('tasks')
    .select('*')
    .eq('organization_id', organizationId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createTask(input: {
  title: string;
  description?: string;
  assigned_to?: string | null;
  status?: string;
  priority?: string;
  due_at?: string | null;
}): Promise<Task> {
  const organizationId = await getOrganizationId();

  const { data, error } = await supabase
    .schema('enterprise')
    .from('tasks')
    .insert({
      organization_id: organizationId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assigned_to: input.assigned_to || null,
      status: input.status || 'todo',
      priority: input.priority || 'normal',
      due_at: input.due_at || null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Task;
}

export async function updateTask(
  id: string,
  input: {
    title: string;
    description?: string;
    assigned_to?: string | null;
    status: string;
    priority: string;
    due_at?: string | null;
  },
): Promise<Task> {
  const { data, error } = await supabase
    .schema('enterprise')
    .from('tasks')
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assigned_to: input.assigned_to || null,
      status: input.status,
      priority: input.priority,
      due_at: input.due_at || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .schema('enterprise')
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
