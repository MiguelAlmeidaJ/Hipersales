import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { SelectField } from "@/components/form-controls";
import { Card, Input, ModulePage, Notice } from "@/components/module-ui";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api } from "@/lib/api";
import { formatCnpj, money } from "@/lib/format";
import type { Customer } from "@/types/commercial";

type Progress={enabled:boolean;goal:number|null;realized:number;missing:number;percent:number};
type Goals={sales:Progress;new_customers:Progress;customer_positivation:Progress;portfolio:{customers:number;attended:number}};
type Sales={resumo?:{qtdPedidos?:number;valorTotal?:number};pedidos?:Record<string,unknown>[]};
type ActivityData={orders:number;revenue:number;goals:Goals|null;customersToVisit:Customer[];visitListAvailable:boolean};

const months=Array.from({length:12},(_,index)=>({value:String(index+1),label:new Date(2026,index,1).toLocaleString("pt-BR",{month:"long"})}));
const apiDate=(value:Date)=>`${String(value.getDate()).padStart(2,"0")}/${String(value.getMonth()+1).padStart(2,"0")}/${value.getFullYear()}`;
function readCustomerIds(data:unknown){
  const record=data&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:{};
  const rows=Array.isArray(data)?data:[record.ids,record.customer_ids,record.clientes,record.itens,record.atendidos].find(Array.isArray)||[];
  return new Set((rows as unknown[]).map(item=>typeof item==="number"||typeof item==="string"?Number(item):item&&typeof item==="object"?Number((item as Record<string,unknown>).idCliente||(item as Record<string,unknown>).customer_id||(item as Record<string,unknown>).id_cliente||(item as Record<string,unknown>).id):0).filter(Boolean));
}
function customerIdsFromOrders(orders:Record<string,unknown>[]){return new Set(orders.map(item=>Number(item.idCliente||item.customer_id||item.id_cliente)).filter(Boolean));}
function isApproved(customer:Customer){const value=String(customer.statusCadastro||customer.status||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();return Boolean(customer.active)||value==="APROVADO"||value==="ATIVO";}

async function fetchActivities(year:number,month:number):Promise<ActivityData>{
  const today=new Date(),lastDay=new Date(year,month,0),end=year===today.getFullYear()&&month===today.getMonth()+1?today:lastDay;
  const startText=apiDate(new Date(year,month-1,1)),endText=apiDate(end);
  const [salesResult,goalsResult,customersResult,attendedResult]=await Promise.allSettled([
    api<Sales>((`/api/sales?de=${startText}&ate=${endText}&tamanho=200`) as `/api/${string}`),
    api<{goals?:Goals}>((`/api/goals/my?year=${year}&month=${month}`) as `/api/${string}`),
    api<{customers:Customer[]}>("/api/customers"),
    api<unknown>((`/api/customer-ids?de=${startText}&ate=${endText}`) as `/api/${string}`),
  ]);
  if(salesResult.status==="rejected")throw salesResult.reason;
  const attendedIds=attendedResult.status==="fulfilled"?readCustomerIds(attendedResult.value):customerIdsFromOrders(salesResult.value.pedidos||[]);
  const customers=customersResult.status==="fulfilled"?customersResult.value.customers||[]:[];
  return {orders:Number(salesResult.value.resumo?.qtdPedidos||0),revenue:Number(salesResult.value.resumo?.valorTotal||0),goals:goalsResult.status==="fulfilled"?goalsResult.value.goals||null:null,customersToVisit:customers.filter(customer=>isApproved(customer)&&!attendedIds.has(customer.id)).sort((a,b)=>(a.trade_name||a.legal_name).localeCompare(b.trade_name||b.legal_name,"pt-BR")),visitListAvailable:customersResult.status==="fulfilled"};
}

export default function ActivitiesScreen(){
  const {status}=useSession(),now=new Date();
  const [month,setMonth]=useState(String(now.getMonth()+1)),[year,setYear]=useState(String(now.getFullYear()));
  const [data,setData]=useState<ActivityData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{setData(await fetchActivities(Number(year),Number(month)));}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível carregar suas atividades.");}finally{setLoading(false);}},[month,year]);
  useEffect(()=>{const timer=setTimeout(()=>{void load();},0);return()=>clearTimeout(timer);},[load]);
  if(status==="anonymous")return <Redirect href="/login"/>;
  if(status==="unavailable")return <Redirect href="/"/>;
  const goals=data?.goals;
  return <ModulePage title="Minhas atividades" subtitle="Veja como está o seu mês comercial.">
    <Card><View style={styles.period}><View style={styles.month}><SelectField label="Mês" value={month} onChange={setMonth} options={months}/></View><View style={styles.year}><Input label="Ano" keyboardType="number-pad" value={year} onChangeText={setYear}/></View></View><Pressable accessibilityRole="button" onPress={()=>void load()} style={styles.refresh}><AppIcon name="refresh" color={colors.brand} size={17}/><Text style={styles.refreshText}>Atualizar números</Text></Pressable></Card>
    {error?<Notice tone="error">{error}</Notice>:null}
    {loading?<ActivityIndicator color={colors.brand} style={styles.loading}/>:<>
      <View style={styles.grid}>
        <Metric icon="cash-outline" title="Vendas" value={money(goals?.sales.realized??data?.revenue??0)} detail={goals?.sales.enabled?`Meta ${money(goals.sales.goal||0)}`:"Realizado no período"} percent={goals?.sales.enabled?goals.sales.percent:undefined}/>
        <Metric icon="receipt-outline" title="Pedidos" value={String(data?.orders||0)} detail="Pedidos no período"/>
        <Metric icon="person-add-outline" title="Novos clientes" value={String(goals?.new_customers.realized||0)} detail={goals?.new_customers.enabled?`Meta ${goals.new_customers.goal}`:"Sem meta cadastrada"} percent={goals?.new_customers.enabled?goals.new_customers.percent:undefined}/>
        <Metric icon="people-outline" title="Positivação" value={`${Math.round(goals?.customer_positivation.realized||0)}%`} detail={goals?.customer_positivation.enabled?`Meta ${goals.customer_positivation.goal}%`:"Sem meta cadastrada"} percent={goals?.customer_positivation.enabled?goals.customer_positivation.percent:undefined}/>
      </View>
      {goals?<Card><Text style={styles.sectionTitle}>Sua carteira neste mês</Text><View style={styles.portfolioRow}><View style={styles.portfolioNumber}><Text style={styles.big}>{goals.portfolio.attended}</Text><Text style={styles.caption}>atendidos</Text></View><View style={styles.divider}/><View style={styles.portfolioNumber}><Text style={styles.big}>{goals.portfolio.customers}</Text><Text style={styles.caption}>na carteira</Text></View><View style={styles.divider}/><View style={styles.portfolioNumber}><Text style={styles.big}>{Math.max(0,goals.portfolio.customers-goals.portfolio.attended)}</Text><Text style={styles.caption}>a visitar</Text></View></View></Card>:<Notice tone="info">Ainda não existem metas cadastradas para este período. Os pedidos e as vendas continuam disponíveis acima.</Notice>}
      <VisitList customers={data?.customersToVisit||[]} available={Boolean(data?.visitListAvailable)} />
    </>}
  </ModulePage>;
}

function Metric({icon,title,value,detail,percent}:{icon:AppIconName;title:string;value:string;detail:string;percent?:number}){return <View style={styles.metric}><View style={styles.metricTop}><View style={styles.icon}><AppIcon name={icon} color={colors.brand} size={20}/></View><Text style={styles.metricTitle}>{title}</Text></View><Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.detail}>{detail}</Text>{percent!=null?<><View style={styles.track}><View style={[styles.progress,{width:`${Math.max(0,Math.min(100,percent))}%`}]} /></View><Text style={styles.percent}>{Math.round(percent)}% alcançado</Text></>:null}</View>}

function VisitList({customers,available}:{customers:Customer[];available:boolean}){
  return <Card style={styles.visitCard}><View style={styles.visitHeading}><View><Text style={styles.sectionTitle}>Clientes que precisam de atenção URGENTE</Text><Text style={styles.visitSubtitle}>Ainda não atendidos no período selecionado</Text></View>{available?<View style={styles.visitCount}><Text style={styles.visitCountText}>{customers.length}</Text></View>:null}</View>{!available?<View style={styles.visitEmpty}><AppIcon name="cloud-offline-outline" color={colors.muted} size={25}/><Text style={styles.visitEmptyTitle}>Lista indisponível</Text><Text style={styles.visitEmptyText}>Não foi possível carregar os clientes da carteira.</Text></View>:customers.length===0?<View style={styles.visitEmpty}><AppIcon name="checkmark-circle-outline" color={colors.success} size={28}/><Text style={styles.visitEmptyTitle}>Carteira atendida</Text><Text style={styles.visitEmptyText}>Nenhum cliente pendente de visita neste período.</Text></View>:customers.map((customer,index)=><View key={customer.id} style={[styles.visitRow,index===customers.length-1&&styles.visitRowLast]}><View style={styles.visitAvatar}><Text style={styles.visitAvatarText}>{(customer.trade_name||customer.legal_name).split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</Text></View><View style={styles.visitCopy}><Text style={styles.visitName} numberOfLines={1}>{customer.trade_name||customer.legal_name}</Text>{customer.trade_name?<Text style={styles.visitLegalName} numberOfLines={1}>{customer.legal_name}</Text>:null}<Text style={styles.visitMeta} numberOfLines={1}>{[formatCnpj(customer.cnpj),customer.address].filter(Boolean).join(" · ")}</Text></View><AppIcon name="location-outline" color={colors.accent} size={20}/></View>)}</Card>;
}

const styles=StyleSheet.create({period:{flexDirection:"row",gap:12},month:{flex:1.5},year:{flex:1},refresh:{height:42,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderRadius:12,backgroundColor:"#E8F3FB"},refreshText:{color:colors.brand,fontSize:12,fontWeight:"900"},loading:{marginTop:48},grid:{flexDirection:"row",flexWrap:"wrap",gap:10,padding:16,paddingBottom:0},metric:{width:"48%",flexGrow:1,minHeight:155,padding:15,borderRadius:18,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},metricTop:{flexDirection:"row",alignItems:"center",gap:8},icon:{width:34,height:34,borderRadius:11,alignItems:"center",justifyContent:"center",backgroundColor:"#E8F3FB"},metricTitle:{flex:1,color:colors.muted,fontSize:11,fontWeight:"800"},value:{color:colors.ink,fontSize:22,fontWeight:"900",marginTop:13},detail:{color:colors.muted,fontSize:10,marginTop:3},track:{height:7,borderRadius:99,overflow:"hidden",backgroundColor:"#DFE8E5",marginTop:11},progress:{height:7,borderRadius:99,backgroundColor:colors.accent},percent:{color:colors.brandDark,fontSize:9,fontWeight:"800",textAlign:"right",marginTop:4},sectionTitle:{color:colors.ink,fontSize:16,fontWeight:"900",marginBottom:16},portfolioRow:{flexDirection:"row",alignItems:"center"},portfolioNumber:{flex:1,alignItems:"center"},big:{color:colors.ink,fontSize:24,fontWeight:"900"},caption:{color:colors.muted,fontSize:9,fontWeight:"700",marginTop:3},divider:{width:1,height:42,backgroundColor:colors.border},visitCard:{paddingBottom:5},visitHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:8},visitSubtitle:{color:colors.muted,fontSize:10,marginTop:-11},visitCount:{minWidth:34,height:34,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:"#FFF0DF"},visitCountText:{color:"#B85800",fontSize:14,fontWeight:"900"},visitRow:{minHeight:76,flexDirection:"row",alignItems:"center",gap:11,borderBottomWidth:1,borderBottomColor:"#EDF1F1",paddingVertical:11},visitRowLast:{borderBottomWidth:0},visitAvatar:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"#E8F3FB"},visitAvatarText:{color:colors.brand,fontSize:12,fontWeight:"900"},visitCopy:{flex:1},visitName:{color:colors.ink,fontSize:13,fontWeight:"900"},visitLegalName:{color:colors.muted,fontSize:10,marginTop:2},visitMeta:{color:colors.muted,fontSize:9,marginTop:5},visitEmpty:{alignItems:"center",paddingVertical:24},visitEmptyTitle:{color:colors.ink,fontSize:13,fontWeight:"900",marginTop:8},visitEmptyText:{color:colors.muted,fontSize:10,textAlign:"center",marginTop:3}});
