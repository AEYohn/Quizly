import { Tabs } from "expo-router";
import {
  Home,
  Trophy,
  User,
  Gamepad2,
  Plus,
  BookOpen,
} from "lucide-react-native";

export default function StudentLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6366F1",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          paddingTop: 8,
          paddingBottom: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      {/* Visible tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color, size }) => (
            <Trophy size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

      {/* Hidden tabs — accessible via navigation but not shown in tab bar */}
      <Tabs.Screen
        name="feed"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="skill-tree"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="subject-select"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="pdf-upload"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="assessment"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="topic-notes"
        options={{ href: null }}
      />

      {/* Existing routes — hidden from tab bar */}
      <Tabs.Screen
        name="join"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="create"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="study"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="social"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
    </Tabs>
  );
}
