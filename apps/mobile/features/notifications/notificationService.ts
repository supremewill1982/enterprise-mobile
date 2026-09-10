import { supabase } from '../../lib/supabase';

export type Notification = {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string | null;
  read_at: string | null;
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
  return { organizationId: data.organization_id, userId: user.id };
}

export async function listNotifications() {
  const { organizationId, userId } = await getOrganizationId();

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', organizationId)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function getUnreadNotificationCount() {
  const notifications = await listNotifications();
  return notifications.filter((notification) => !notification.read_at).length;
}

export async function createNotification(input: {
  user_id?: string | null;
  type: string;
  title: string;
  message?: string | null;
}) {
  const { organizationId } = await getOrganizationId();

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      organization_id: organizationId,
      user_id: input.user_id || null,
      type: input.type,
      title: input.title.trim(),
      message: input.message?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Notification;
}

export async function markNotificationAsRead(id: string) {
  const { organizationId, userId } = await getOrganizationId();

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .or(`user_id.is.null,user_id.eq.${userId}`);

  if (error) throw error;
}

export async function markAllNotificationsAsRead() {
  const { organizationId, userId } = await getOrganizationId();

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .is('read_at', null)
    .or(`user_id.is.null,user_id.eq.${userId}`);

  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { organizationId, userId } = await getOrganizationId();

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)
    .or(`user_id.is.null,user_id.eq.${userId}`);

  if (error) throw error;
}
