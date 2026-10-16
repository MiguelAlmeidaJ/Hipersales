import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";

const icons: Record<string, { active: AppIconName; inactive: AppIconName }> = {
  index: { active: "home", inactive: "home-outline" },
  orders: { active: "receipt", inactive: "receipt-outline" },
  customers: { active: "people", inactive: "people-outline" },
  modules: { active: "grid", inactive: "grid-outline" },
  profile: { active: "person-circle", inactive: "person-circle-outline" },
};

export default function AppLayout() {
  const { status, user } = useSession();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role === "admin" || user?.role === "dev";

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;
  if (user?.must_change_password) return <Redirect href="/change-password" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: "#7B899B",
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, focused }) => {
          const icon = icons[route.name] ?? icons.index;
          return <AppIcon name={focused ? icon.active : icon.inactive} color={color} size={23} />;
        },
        tabBarItemStyle: { paddingTop: 5 },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 13, fontWeight: "700" },
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: colors.border,
          borderTopWidth: 1,
          backgroundColor: colors.surface,
          elevation: 12,
          shadowColor: "#0B2440",
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
      })}>
      <Tabs.Screen name="index" options={{ title: "Início" }} />
      <Tabs.Screen name="orders" options={{ title: "Pedidos" }} />
      <Tabs.Screen name="customers" options={{ title: "Clientes", href: isAdmin ? null : undefined }} />
      <Tabs.Screen name="modules" options={{ title: "Módulos", href: isAdmin ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
