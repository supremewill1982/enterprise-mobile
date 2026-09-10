import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  Notification,
} from './notificationService';

import { usePermission } from '../../lib/usePermission';
export default function NotificationsScreen() {
  const { allowed: canView } = usePermission('communication', 'view');
  const { allowed: canCreate } = usePermission('communication', 'create');
  const { allowed: canEdit } = usePermission('communication', 'edit');
  const { allowed: canDelete } = usePermission('communication', 'delete');

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setNotifications(await listNotifications());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Impossible de charger les notifications',
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

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notifications;

    return notifications.filter((notification) =>
      `${notification.title} ${notification.message ?? ''} ${notification.type}`
        .toLowerCase()
        .includes(q),
    );
  }, [notifications, search]);

  const markRead = async (notification: Notification) => {
    if (notification.read_at) return;

    try {
      await markNotificationAsRead(notification.id);
      await load();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible de marquer la notification',
      );
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;

    try {
      await markAllNotificationsAsRead();
      await load();
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible de marquer les notifications',
      );
    }
  };

  const remove = (notification: Notification) => {
    Alert.alert(
      'Supprimer la notification',
      `Supprimer « ${notification.title} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification(notification.id);
              await load();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error
                  ? e.message
                  : 'Impossible de supprimer la notification',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount
              ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Tout est à jour'}
          </Text>
        </View>

        {unreadCount > 0 && canEdit && (
          <Pressable style={styles.readAll} onPress={markAllRead}>
            <Text style={styles.readAllText}>Tout lire</Text>
          </Pressable>
        )}
      </View>

      <TextInput
        style={styles.search}
        placeholder="Rechercher..."
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
        <Text style={styles.info}>Aucune notification.</Text>
      ) : (
        filtered.map((notification) => (
          <Pressable
            key={notification.id}
            style={[
              styles.card,
              !notification.read_at && styles.unreadCard,
            ]}
            onPress={canEdit ? () => markRead(notification) : undefined}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.type}>{notification.type}</Text>

              {!notification.read_at && <View style={styles.dot} />}
            </View>

            <Text style={styles.notificationTitle}>
              {notification.title}
            </Text>

            {notification.message ? (
              <Text style={styles.message}>{notification.message}</Text>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.date}>
                {new Date(notification.created_at).toLocaleString('fr-FR')}
              </Text>

              {canDelete && (
                <Pressable onPress={() => remove(notification)}>
                  <Text style={styles.delete}>Supprimer</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: '#666',
  },
  readAll: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  readAllText: {
    color: '#fff',
    fontWeight: '600',
  },
  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  info: {
    color: '#666',
    paddingVertical: 20,
  },
  error: {
    color: '#b00020',
    marginBottom: 8,
  },
  retry: {
    fontWeight: '600',
    paddingVertical: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  unreadCard: {
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  type: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#666',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111',
  },
  notificationTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  message: {
    color: '#555',
    marginTop: 6,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  date: {
    color: '#888',
    fontSize: 11,
  },
  delete: {
    color: '#b00020',
    fontSize: 12,
    fontWeight: '600',
  },
});
