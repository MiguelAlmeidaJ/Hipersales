import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { colors } from "@/constants/colors";
import { useNotifications } from "@/contexts/notifications-context";

export function NotificationBell(){const {unreadCount}=useNotifications();return <Pressable accessibilityRole="button" accessibilityLabel={unreadCount?`${unreadCount} notificacoes nao lidas`:"Notificacoes"} onPress={()=>router.push("/notifications" as Href)} style={({pressed})=>[styles.button,pressed&&styles.pressed]}><AppIcon name={unreadCount?"notifications":"notifications-outline"} color={colors.brandDark} size={24}/>{unreadCount>0?<View style={styles.badge}><Text style={styles.badgeText}>{unreadCount>99?"99+":unreadCount}</Text></View>:null}</Pressable>;}
const styles=StyleSheet.create({button:{width:44,height:44,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EAF3FA"},pressed:{opacity:.65},badge:{position:"absolute",right:-3,top:-4,minWidth:19,height:19,paddingHorizontal:4,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:colors.danger,borderWidth:2,borderColor:colors.surface},badgeText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"}});
