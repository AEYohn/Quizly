import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { useSocialStore } from '@/stores/socialStore';
import { Button, Card } from '@/components/ui';
import { UserSearchResult } from '@/components/social';
import { UserPreview } from '@/types/social';

// Mock search results for demo
const MOCK_USERS: UserPreview[] = [
  { id: '1', name: 'Alex Chen', level: 15, streak: 12 },
  { id: '2', name: 'Sarah Kim', level: 12, streak: 5 },
  { id: '3', name: 'Mike Johnson', level: 8, streak: 0 },
  { id: '4', name: 'Emma Davis', level: 20, streak: 45 },
];

export default function SearchScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { friends, pendingRequests, addPendingRequest } = useSocialStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPreview[]>([]);

  const bgColor = isDark ? 'bg-gray-900' : 'bg-gray-50';

  const friendIds = friends.map((f) => f.id);
  const pendingIds = pendingRequests.map((r) => r.user.id);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (text.length > 0) {
      // In real app, call API
      const filtered = MOCK_USERS.filter((u) =>
        u.name.toLowerCase().includes(text.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, []);

  const handleAddFriend = (user: UserPreview) => {
    addPendingRequest({
      id: `req-${Date.now()}`,
      user,
      sentAt: new Date().toISOString(),
      direction: 'outgoing',
    });
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View style={styles.header}>
        <Button variant="ghost" icon={ArrowLeft} onPress={() => router.back()} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Find Friends
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
              borderColor: colors.border,
            },
          ]}
        >
          <Search size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={handleSearch}
            placeholder="Search by name..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoFocus
          />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {results.length > 0 ? (
          results.map((user) => (
            <UserSearchResult
              key={user.id}
              user={user}
              isFriend={friendIds.includes(user.id)}
              isPending={pendingIds.includes(user.id)}
              onAddFriend={() => handleAddFriend(user)}
            />
          ))
        ) : query.length > 0 ? (
          <Card variant="outline" className="items-center py-8">
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No users found for "{query}"
            </Text>
          </Card>
        ) : (
          <Card variant="outline" className="items-center py-8">
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Search for friends by name
            </Text>
          </Card>
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
