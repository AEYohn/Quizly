import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { UserPlus, Check } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { UserPreview } from '@/types/social';
import { Button } from '@/components/ui';

interface UserSearchResultProps {
  user: UserPreview;
  isFriend?: boolean;
  isPending?: boolean;
  onAddFriend?: () => void;
  onPress?: () => void;
}

export function UserSearchResult({
  user,
  isFriend = false,
  isPending = false,
  onAddFriend,
  onPress,
}: UserSearchResultProps) {
  const { colors, isDark } = useTheme();

  // Light color variants
  const successLight = isDark ? '#064E3B' : '#D1FAE5';
  const brandLight = isDark ? '#312E81' : '#EEF2FF';

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
        <Text style={styles.avatarText}>
          {user.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {user.name}
        </Text>
        <Text style={[styles.level, { color: colors.textSecondary }]}>
          Level {user.level}
        </Text>
      </View>

      {isFriend ? (
        <View style={[styles.badge, { backgroundColor: successLight }]}>
          <Check size={16} color={colors.success} />
          <Text style={[styles.badgeText, { color: colors.success }]}>
            Friends
          </Text>
        </View>
      ) : isPending ? (
        <View style={[styles.badge, { backgroundColor: brandLight }]}>
          <Text style={[styles.badgeText, { color: colors.brand }]}>
            Pending
          </Text>
        </View>
      ) : (
        <Button
          size="sm"
          variant="outline"
          icon={UserPlus}
          onPress={onAddFriend}
        >
          Add
        </Button>
      )}
    </Pressable>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  level: {
    fontSize: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
