import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, UserPlus } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSocialStore } from '@/stores/socialStore';
import { Button, Card } from '@/components/ui';
import { FriendCard, FriendRequestCard } from '@/components/social';

export default function FriendsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { friends, pendingRequests, removeFriend, removePendingRequest, addFriend } =
    useSocialStore();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-white';

  const incomingRequests = pendingRequests.filter((r) => r.direction === 'incoming');
  const outgoingRequests = pendingRequests.filter((r) => r.direction === 'outgoing');

  const handleRemoveFriend = (userId: string, name: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${name} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend(userId),
        },
      ]
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View style={styles.header}>
        <Button variant="ghost" icon={ArrowLeft} onPress={() => router.back()}>
          {' '}
        </Button>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Friends</Text>
        <Button
          variant="ghost"
          icon={UserPlus}
          onPress={() => router.push('/social/search')}
        >
          {' '}
        </Button>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
        <Button
          variant={activeTab === 'friends' ? 'primary' : 'ghost'}
          size="sm"
          onPress={() => setActiveTab('friends')}
          className="flex-1"
        >
          Friends ({friends.length})
        </Button>
        <Button
          variant={activeTab === 'requests' ? 'primary' : 'ghost'}
          size="sm"
          onPress={() => setActiveTab('requests')}
          className="flex-1"
        >
          Requests ({incomingRequests.length})
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {activeTab === 'friends' ? (
          friends.length > 0 ? (
            friends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onRemove={() => handleRemoveFriend(friend.id, friend.name)}
              />
            ))
          ) : (
            <Card variant="outline" className={`items-center py-8 ${cardBg}`}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No friends yet. Add some!
              </Text>
              <Button
                variant="primary"
                size="sm"
                icon={UserPlus}
                className="mt-4"
                onPress={() => router.push('/social/search')}
              >
                Find Friends
              </Button>
            </Card>
          )
        ) : (
          <>
            {incomingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Incoming
                </Text>
                {incomingRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    onAccept={() => {
                      // In real app, call API then update store
                      addFriend({
                        ...request.user,
                        addedAt: new Date().toISOString(),
                        status: 'offline',
                      });
                      removePendingRequest(request.id);
                    }}
                    onDecline={() => removePendingRequest(request.id)}
                  />
                ))}
              </View>
            )}

            {outgoingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Sent
                </Text>
                {outgoingRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    onCancel={() => removePendingRequest(request.id)}
                  />
                ))}
              </View>
            )}

            {pendingRequests.length === 0 && (
              <Card variant="outline" className={`items-center py-8 ${cardBg}`}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No pending requests
                </Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
