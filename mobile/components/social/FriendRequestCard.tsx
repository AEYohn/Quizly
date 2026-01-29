import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { FriendRequest } from '@/types/social';
import { Button } from '@/components/ui';

interface FriendRequestCardProps {
  request: FriendRequest;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}

export function FriendRequestCard({
  request,
  onAccept,
  onDecline,
  onCancel,
}: FriendRequestCardProps) {
  const { colors, isDark } = useTheme();
  const isIncoming = request.direction === 'incoming';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
        <Text style={styles.avatarText}>
          {request.user.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {request.user.name}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isIncoming ? 'Wants to be friends' : 'Request sent'}
        </Text>
      </View>

      {isIncoming ? (
        <View style={styles.actions}>
          <Button
            size="sm"
            variant="primary"
            icon={Check}
            onPress={onAccept}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            onPress={onDecline}
          >
            Decline
          </Button>
        </View>
      ) : (
        <Button size="sm" variant="ghost" onPress={onCancel}>
          Cancel
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});
