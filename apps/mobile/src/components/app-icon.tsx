import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

export type AppIconName = ComponentProps<typeof Ionicons>["name"];

export function AppIcon({ name, color, size = 22 }: { name: AppIconName; color: ColorValue; size?: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}
