import { Redirect, router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import { ScreenHeader } from "@/components/screen-header";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { useMockApi } from "@/lib/api";
type ModuleItem={title:string;description:string;icon:AppIconName;color:string;background:string;route:Href};
const nativeRoute = (value: string): Href => value as Href;
const modules:ModuleItem[]=[
 {title:"Painel",description:"Indicadores executivos",icon:"analytics-outline",color:colors.brand,background:"#E8F3FB",route:"/(app)"},
 {title:"Pedidos",description:"Propostas e andamento",icon:"receipt-outline",color:"#B54708",background:"#FFF1E5",route:"/(app)/orders"},
 {title:"Clientes",description:"Cadastros e carteira",icon:"people-outline",color:colors.success,background:"#E7F7F0",route:"/(app)/customers"},
 {title:"Empresas",description:"Indústrias representadas",icon:"business-outline",color:"#475467",background:"#EEF2F6",route:nativeRoute("/companies")},
 {title:"Produtos",description:"Catálogo comercial",icon:"cube-outline",color:"#7A5AF8",background:"#F0ECFF",route:nativeRoute("/products")},
 {title:"Aprovações",description:"Solicitações pendentes",icon:"checkmark-done-outline",color:"#4C7E27",background:"#EDF7E7",route:nativeRoute("/approvals")},
 {title:"Ocorrências",description:"Atendimento e histórico",icon:"alert-circle-outline",color:colors.danger,background:"#FDEBEC",route:nativeRoute("/occurrences")},
 {title:"Metas",description:"Objetivos da equipe",icon:"flag-outline",color:"#02779F",background:"#E5F6FC",route:nativeRoute("/goals")},
 {title:"Usuários",description:"Equipe, permissões e carteiras",icon:"person-circle-outline",color:colors.brandDark,background:"#E9EFFB",route:nativeRoute("/users")},
 {title:"Relatórios",description:"Análises e documentos",icon:"bar-chart-outline",color:"#B54708",background:"#FFF1E5",route:nativeRoute("/reports")},
 {title:"Configurações",description:"Integrações e operação",icon:"settings-outline",color:"#475467",background:"#EEF2F6",route:nativeRoute("/settings")},
];
export default function ModulesScreen(){const {user}=useSession();const isAdmin=user?.role==="admin"||user?.role==="dev";const visible=useMockApi?modules:modules.filter(item=>["Painel","Pedidos","Clientes"].includes(item.title));if(!isAdmin)return <Redirect href="/(app)"/>;return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><ScreenHeader eyebrow="Administração" title="Módulos" subtitle="Funções publicadas pela API HiperSales."/><View style={styles.notice}><AppIcon name="phone-portrait-outline" color={colors.brand} size={22}/><Text style={styles.noticeText}>{useMockApi?"Todas as rotinas estão liberadas no ambiente de demonstração.":"A API atual permite consultar pedidos, clientes e indicadores. Os demais módulos aparecerão quando o servidor publicar as respectivas rotas."}</Text></View><View style={styles.grid}>{visible.map(item=><Pressable key={item.title} accessibilityRole="button" onPress={()=>router.push(item.route)} style={({pressed})=>[styles.card,pressed&&styles.pressed]}><View style={styles.cardTop}><View style={[styles.icon,{backgroundColor:item.background}]}><AppIcon name={item.icon} color={item.color} size={25}/></View><AppIcon name="chevron-forward" color="#A0AEC0" size={18}/></View><Text style={styles.title}>{item.title}</Text><Text style={styles.description}>{item.description}</Text></Pressable>)}</View></ScrollView>}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:colors.canvas},content:{paddingBottom:28},notice:{flexDirection:"row",alignItems:"center",gap:12,margin:20,marginBottom:4,padding:14,borderRadius:16,backgroundColor:"#E8F3FB"},noticeText:{flex:1,color:colors.brandDark,fontSize:11,lineHeight:17,fontWeight:"600"},grid:{flexDirection:"row",flexWrap:"wrap",gap:12,padding:20},card:{width:"48%",flexGrow:1,minHeight:142,padding:15,borderRadius:19,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},cardTop:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between"},icon:{width:44,height:44,borderRadius:14,alignItems:"center",justifyContent:"center"},title:{color:colors.ink,fontSize:14,fontWeight:"900",marginTop:14},description:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:4},pressed:{opacity:.72,transform:[{scale:.985}]}});
