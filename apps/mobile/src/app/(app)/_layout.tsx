import { Redirect, Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";

import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";

const tabIcon = (symbol: string) =>
  function Icon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 21, fontWeight: "800" }}>{symbol}</Text>;
  };

export default function AppLayout() {
  const { status, user } = useSession();

  if (status === "anonymous") return <Redirect href="/login" />;
  if (status === "unavailable") return <Redirect href="/" />;
  if (user?.must_change_password) return <Redirect href="/change-password" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: "#8190A3",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginBottom: 3 },
        tabBarStyle: { height: 66, paddingTop: 7, borderTopColor: colors.border, backgroundColor: colors.surface },
      }}>
      <Tabs.Screen name="index" options={{ title: "Início", tabBarIcon: tabIcon("⌂") }} />
      <Tabs.Screen name="orders" options={{ title: "Pedidos", tabBarIcon: tabIcon("▤") }} />
      <Tabs.Screen name="customers" options={{ title: "Clientes", tabBarIcon: tabIcon("●") }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarIcon: tabIcon("◉") }} />
    </Tabs>
  );
}
