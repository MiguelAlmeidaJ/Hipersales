import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";

type Item={label:string;route:"/(app)"|"/(app)/orders"|"/(app)/customers"|"/(app)/modules"|"/(app)/profile";activePath:string;icon:AppIconName;activeIcon:AppIconName};

export function BottomNavigation(){
  const {user}=useSession(),path=usePathname(),insets=useSafeAreaInsets();
  const admin=user?.role==="admin"||user?.role==="dev";
  const items:Item[]=[
    {label:"Início",route:"/(app)",activePath:"/",icon:"home-outline",activeIcon:"home"},
    {label:"Pedidos",route:"/(app)/orders",activePath:"/orders",icon:"receipt-outline",activeIcon:"receipt"},
    admin?{label:"Módulos",route:"/(app)/modules",activePath:"/modules",icon:"grid-outline",activeIcon:"grid"}:{label:"Clientes",route:"/(app)/customers",activePath:"/customers",icon:"people-outline",activeIcon:"people"},
    {label:"Perfil",route:"/(app)/profile",activePath:"/profile",icon:"person-circle-outline",activeIcon:"person-circle"},
  ];
  return <View style={[styles.bar,{paddingBottom:Math.max(insets.bottom,8),height:62+insets.bottom}]}>{items.map(item=>{const active=path===item.activePath;return <Pressable key={item.label} accessibilityRole="button" accessibilityState={{selected:active}} onPress={()=>router.replace(item.route)} style={({pressed})=>[styles.item,pressed&&styles.pressed]}><AppIcon name={active?item.activeIcon:item.icon} color={active?colors.brand:"#7B899B"} size={23}/><Text style={[styles.label,active&&styles.active]}>{item.label}</Text></Pressable>;})}</View>;
}

const styles=StyleSheet.create({bar:{flexDirection:"row",alignItems:"flex-start",paddingTop:7,borderTopWidth:1,borderTopColor:colors.border,backgroundColor:colors.surface,shadowColor:"#0B2440",shadowOpacity:.08,shadowRadius:12,elevation:12},item:{flex:1,alignItems:"center",justifyContent:"center",gap:3},pressed:{opacity:.62},label:{color:"#7B899B",fontSize:10,lineHeight:13,fontWeight:"700"},active:{color:colors.brand}});
