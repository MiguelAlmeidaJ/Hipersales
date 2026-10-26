import * as FileSystem from "expo-file-system/legacy";
import { Redirect, router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { EmptyState, ErrorState, LoadingState } from "@/components/list-states";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api, authenticatedResource } from "@/lib/api";
import { money } from "@/lib/format";

type PriceTable = {
  id: number;
  companyId: number;
  companyName: string;
  description: string;
  freight?: string;
  minimum?: number;
  leadTimeDays?: number;
  payment?: string;
};

type Product = { id: number; code: string; name: string; unit: string; price: number; priceWithIpi?: number };

const rowsOf = (data: unknown): any[] => Array.isArray(data) ? data : typeof data === "object" && data !== null ? ((data as any).itens || []) : [];
const numeric = (...values: unknown[]) => Number(values.find(value => value !== undefined && value !== null && value !== "") || 0);
const textual = (...values: unknown[]) => String(values.find(value => typeof value === "string" && value.trim()) || "");

function normalizeTables(data: unknown): PriceTable[] {
  return rowsOf(data).map(row => ({
    id: numeric(row.idTabela, row.id), companyId: numeric(row.idEmpresa),
    companyName: textual(row.empresaNome, row.empresa?.nome, `Empresa ${row.idEmpresa}`),
    description: textual(row.descricao, row.nome, `Tabela ${row.idTabela || row.id}`),
    freight: textual(row.frete), minimum: numeric(row.pedidoMinimo), leadTimeDays: numeric(row.prazoEntregaDias),
    payment: textual(row.condPagtoDescricao),
  })).filter(row => row.id);
}

function normalizeProducts(data: unknown): Product[] {
  return rowsOf(data).map(row => ({
    id: numeric(row.idProduto, row.id), code: textual(row.codigo, row.referencia, row.idProduto),
    name: textual(row.descricao, row.nome), unit: textual(row.unidade, row.unidadeVenda),
    price: numeric(row.preco, row.precoUnitario), priceWithIpi: row.precoComIpi == null ? undefined : numeric(row.precoComIpi),
  })).filter(row => row.id);
}

async function fetchProducts(table:PriceTable,query:string,page:number){const params=new URLSearchParams({idTabela:String(table.id),idEmpresa:String(table.companyId),pagina:String(page),tamanho:"200"});if(query.trim())params.set("busca",query.trim());const result=await api<unknown>((`/api/order-products?${params.toString()}`) as `/api/${string}`);const products=normalizeProducts(result);return {products,total:typeof result==="object"&&result!==null?Number((result as {total?:number}).total??products.length):products.length};}

export default function PriceTablesScreen() {
  const {status}=useSession();
  const [tables,setTables]=useState<PriceTable[]>([]),[selected,setSelected]=useState<PriceTable|null>(null);
  const [products,setProducts]=useState<Product[]>([]),[query,setQuery]=useState("");
  const [productTotal,setProductTotal]=useState(0),[loadingMore,setLoadingMore]=useState(false);
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[sharing,setSharing]=useState(false),[error,setError]=useState("");

  const loadTables=useCallback(async(refresh=false)=>{if(refresh)setRefreshing(true);else setLoading(true);setError("");try{const result=await api<unknown>("/api/price-tables");setTables(normalizeTables(result));}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível carregar as tabelas.");}finally{setLoading(false);setRefreshing(false);}},[]);
  useEffect(()=>{if(status!=="authenticated")return;const timer=setTimeout(()=>{void loadTables();},0);return()=>clearTimeout(timer);},[loadTables,status]);

  useEffect(()=>{
    if(!selected)return;
    let active=true;
    const timer=setTimeout(()=>{setLoading(true);setError("");fetchProducts(selected,query,1).then(result=>{if(active){setProducts(result.products);setProductTotal(result.total);}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Não foi possível carregar os produtos.");}).finally(()=>{if(active)setLoading(false);});},query.trim()?250:0);
    return()=>{active=false;clearTimeout(timer);};
  },[query,selected]);

  const visibleProducts=useMemo(()=>{const term=query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");return term?products.filter(item=>`${item.code} ${item.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(term)):products;},[products,query]);
  const subtitle=useMemo(()=>selected?`${visibleProducts.length}${productTotal>visibleProducts.length?` de ${productTotal}`:""} produto(s)`: `${tables.length} tabela(s) liberada(s)`,[productTotal,selected,tables.length,visibleProducts.length]);
  if(status==="anonymous")return <Redirect href="/login"/>;
  if(status==="unavailable")return <Redirect href="/"/>;

  async function sharePdf(){
    if(!selected)return;
    setSharing(true);setError("");
    try{
      if(Platform.OS==="web")throw new Error("O compartilhamento do PDF está disponível no aplicativo instalado.");
      const resource=authenticatedResource((`/api/price-tables/${selected.id}/pdf`) as `/api/${string}`);
      const target=`${FileSystem.cacheDirectory}tabela-preco-${selected.id}.pdf`;
      const result=await FileSystem.downloadAsync(resource.url,target,{headers:resource.headers});
      if(result.status<200||result.status>=300)throw new Error(result.status===404?"O PDF oficial desta tabela ainda não está disponível na retaguarda.":"Não foi possível baixar o PDF da tabela.");
      if(!await Sharing.isAvailableAsync())throw new Error("O compartilhamento não está disponível neste aparelho.");
      await Sharing.shareAsync(result.uri,{mimeType:"application/pdf",dialogTitle:`Compartilhar ${selected.description}`,UTI:"com.adobe.pdf"});
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível compartilhar a tabela.");}
    finally{setSharing(false);}
  }

  async function loadMoreProducts(){if(!selected||loading||loadingMore||products.length>=productTotal)return;setLoadingMore(true);try{const page=Math.floor(products.length/200)+1;const result=await fetchProducts(selected,query,page);setProducts(current=>Array.from(new Map([...current,...result.products].map(item=>[item.id,item])).values()));setProductTotal(result.total);}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível carregar mais produtos.");}finally{setLoadingMore(false);}}

  function back(){if(selected){setSelected(null);setProducts([]);setProductTotal(0);setQuery("");setError("");}else router.back();}

  return <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
    <View style={styles.header}><Pressable accessibilityLabel="Voltar" onPress={back} style={styles.back}><AppIcon name="arrow-back" color={colors.ink} size={22}/></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>CONSULTA COMERCIAL</Text><Text style={styles.title}>{selected?selected.description:"Tabelas de preço"}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>{selected?<Pressable accessibilityLabel="Compartilhar PDF" disabled={sharing} onPress={()=>void sharePdf()} style={[styles.pdf,sharing&&styles.disabled]}>{sharing?<ActivityIndicator color="#FFF"/>:<AppIcon name="share-social-outline" color="#FFF" size={21}/>}<Text style={styles.pdfText}>PDF</Text></Pressable>:null}</View>

    {selected?<View style={styles.searchWrap}><AppIcon name="search" color={colors.muted} size={19}/><TextInput value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} placeholder="Digite o código ou nome do produto" placeholderTextColor="#8A99AA" style={styles.search}/>{query?<Pressable accessibilityLabel="Limpar busca" onPress={()=>setQuery("")}><AppIcon name="close-circle" color={colors.muted} size={21}/></Pressable>:null}</View>:null}
    {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>:null}

    {loading&&!(selected?products.length:tables.length)?<LoadingState label={selected?"Buscando produtos e preços…":"Carregando suas tabelas…"}/>:selected?
      <FlatList data={visibleProducts} keyExtractor={item=>String(item.id)} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" onEndReached={()=>void loadMoreProducts()} onEndReachedThreshold={.35} ListFooterComponent={loadingMore?<ActivityIndicator color={colors.brand} style={styles.more}/>:null} ListEmptyComponent={<EmptyState title="Nenhum produto encontrado" description="Apague a busca ou tente parte do código ou da descrição."/>} renderItem={({item})=><View style={styles.product}><View style={styles.productCopy}><Text style={styles.productName}>{item.name}</Text><Text style={styles.productMeta}>{[item.code,item.unit].filter(Boolean).join("  •  ")}</Text></View><View style={styles.priceWrap}><Text style={styles.priceLabel}>PREÇO</Text><Text style={styles.price}>{money(item.price)}</Text>{item.priceWithIpi!=null&&item.priceWithIpi!==item.price?<Text style={styles.ipi}>{money(item.priceWithIpi)} c/ IPI</Text>:null}</View></View>}/>
      :error&&!tables.length?<ErrorState message={error} onRetry={()=>void loadTables()}/>:<FlatList data={tables} keyExtractor={item=>String(item.id)} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void loadTables(true)} colors={[colors.brand]}/>} ListEmptyComponent={<EmptyState title="Nenhuma tabela liberada" description="Peça à retaguarda para associar uma tabela de preço ao seu usuário."/>} renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>setSelected(item)} style={({pressed})=>[styles.table,pressed&&styles.pressed]}><View style={styles.tableIcon}><AppIcon name="pricetag-outline" color={colors.brand} size={24}/></View><View style={styles.tableCopy}><Text style={styles.tableName}>{item.description}</Text><Text style={styles.company}>{item.companyName}</Text><Text style={styles.tableMeta}>{[item.payment,item.freight&&`Frete ${item.freight}`,item.minimum?`Mínimo ${money(item.minimum)}`:""].filter(Boolean).join("  •  ")}</Text></View><AppIcon name="chevron-forward" color="#91A1B4" size={20}/></Pressable>}/>} 
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.canvas},header:{flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:16,paddingVertical:14,backgroundColor:colors.surface,borderBottomWidth:1,borderBottomColor:colors.border},back:{width:42,height:42,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EDF3F7"},headerCopy:{flex:1},eyebrow:{color:colors.brandDark,fontSize:9,fontWeight:"900",letterSpacing:1.2},title:{color:colors.ink,fontSize:21,fontWeight:"900",marginTop:2},subtitle:{color:colors.muted,fontSize:11,marginTop:3},pdf:{height:43,flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:13,borderRadius:13,backgroundColor:colors.brand},pdfText:{color:"#FFF",fontSize:11,fontWeight:"900"},disabled:{opacity:.55},searchWrap:{height:54,flexDirection:"row",alignItems:"center",gap:10,margin:16,marginBottom:6,paddingHorizontal:14,borderRadius:16,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},search:{flex:1,color:colors.ink,fontSize:14},error:{marginHorizontal:16,marginTop:10,padding:12,borderRadius:12,backgroundColor:"#FEF2F2"},errorText:{color:colors.danger,fontSize:12,lineHeight:18},list:{padding:16,paddingBottom:36,flexGrow:1,gap:10},more:{paddingVertical:18},table:{flexDirection:"row",alignItems:"center",padding:15,borderRadius:18,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},pressed:{opacity:.72},tableIcon:{width:48,height:48,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#E8F3FB"},tableCopy:{flex:1,marginHorizontal:13},tableName:{color:colors.ink,fontSize:16,fontWeight:"900"},company:{color:colors.brandDark,fontSize:12,fontWeight:"700",marginTop:3},tableMeta:{color:colors.muted,fontSize:10,lineHeight:15,marginTop:6},product:{flexDirection:"row",alignItems:"center",gap:12,padding:15,borderRadius:17,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},productCopy:{flex:1},productName:{color:colors.ink,fontSize:13,lineHeight:18,fontWeight:"900"},productMeta:{color:colors.muted,fontSize:11,marginTop:5},priceWrap:{alignItems:"flex-end",minWidth:88},priceLabel:{color:colors.muted,fontSize:8,fontWeight:"900",letterSpacing:.7},price:{color:colors.brandDark,fontSize:17,fontWeight:"900",marginTop:3},ipi:{color:colors.muted,fontSize:9,marginTop:3},
});
