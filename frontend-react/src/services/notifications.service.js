import supabase from '../lib/supabase';

export async function listNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count || 0;
}

export async function markAsRead(notificationId) {
  const { error } = await supabase.rpc('mark_notifications_read', {
    p_notification_ids: [notificationId],
  });
  if (error) throw error;
}

export async function markAllAsRead(userId) {
  const { error } = await supabase.rpc('mark_all_notifications_read', {
    p_user_id: userId,
  });
  if (error) throw error;
}

export function subscribeToNotifications(userId, callback) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
