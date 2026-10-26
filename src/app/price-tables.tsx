import * as FileSystem from "expo-file-system/legacy";
import { Redirect, router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/list-states";
import { colors } from "@/constants/colors";
import { useSession } from "@/contexts/session-context";
import { api, authenticatedResource, useMockApi } from "@/lib/api";
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
type DialogState = { title: string; message: string; tone: "error" | "success" | "info" };

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

function pdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfMoney(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function buildMockPriceTablePdf(table: PriceTable, products: Product[]) {
  const commands: string[] = [];
  const text = (font: "F1" | "F2" | "F3", size: number, x: number, y: number, value: unknown) => {
    commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
  };

  commands.push("0.02 0.15 0.16 rg 0 770 595 72 re f");
  text("F2", 20, 35, 805, "HIPERSALES");
  text("F1", 9, 35, 788, "TABELA DE PRECO PARA CONSULTA COMERCIAL");
  commands.push("0.94 0.40 0.08 rg 0 764 595 6 re f");
  commands.push("0.02 0.15 0.16 rg");
  text("F2", 18, 35, 730, table.description);
  text("F1", 10, 35, 712, table.companyName);
  text("F1", 9, 35, 688, `Condicao: ${table.payment || "Consulte"}`);
  text("F1", 9, 215, 688, `Frete: ${table.freight || "Consulte"}`);
  text("F1", 9, 350, 688, `Pedido minimo: ${pdfMoney(table.minimum || 0)}`);
  text("F1", 8, 35, 670, `Gerado em ${new Date().toLocaleString("pt-BR")}`);

  commands.push("0.90 0.95 0.97 rg 35 630 525 26 re f");
  commands.push("0.02 0.15 0.16 rg");
  text("F2", 8, 43, 639, "CODIGO       PRODUTO                              UN.       PRECO        C/ IPI");

  let y = 608;
  const visibleRows = products.slice(0, 18);
  visibleRows.forEach((product, index) => {
    if (index % 2 === 1) commands.push(`0.97 0.98 0.98 rg 35 ${y - 8} 525 24 re f`);
    commands.push("0.02 0.15 0.16 rg");
    const code = product.code.slice(0, 11).padEnd(12);
    const name = product.name.slice(0, 35).padEnd(36);
    const unit = product.unit.slice(0, 7).padEnd(9);
    const price = pdfMoney(product.price).padStart(11);
    const ipi = product.priceWithIpi == null ? "-" : pdfMoney(product.priceWithIpi);
    text("F3", 7.5, 43, y, `${code}${name}${unit}${price}   ${ipi}`);
    y -= 28;
  });

  if (products.length > visibleRows.length) text("F1", 8, 43, y, `... e mais ${products.length - visibleRows.length} produto(s).`);
  commands.push("0.82 0.86 0.87 RG 35 82 525 0 re S");
  text("F1", 8, 35, 61, "Documento demonstrativo gerado pelo ambiente mock do HiperSales.");
  text("F1", 8, 35, 47, "Precos sujeitos as regras comerciais configuradas na retaguarda.");

  const stream = commands.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj",
    `7 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach(object => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

async function fetchProducts(table:PriceTable,query:string,page:number){const params=new URLSearchParams({idTabela:String(table.id),idEmpresa:String(table.companyId),pagina:String(page),tamanho:"200"});if(query.trim())params.set("busca",query.trim());const result=await api<unknown>((`/api/order-products?${params.toString()}`) as `/api/${string}`);const products=normalizeProducts(result);return {products,total:typeof result==="object"&&result!==null?Number((result as {total?:number}).total??products.length):products.length};}

export default function PriceTablesScreen() {
  const {status}=useSession();
  const [tables,setTables]=useState<PriceTable[]>([]),[selected,setSelected]=useState<PriceTable|null>(null);
  const [products,setProducts]=useState<Product[]>([]),[query,setQuery]=useState(""),[tableQuery,setTableQuery]=useState("");
  const [productTotal,setProductTotal]=useState(0),[loadingMore,setLoadingMore]=useState(false);
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[sharing,setSharing]=useState(false),[error,setError]=useState("");
  const [dialog,setDialog]=useState<DialogState|null>(null);

  const loadTables=useCallback(async(refresh=false)=>{if(refresh)setRefreshing(true);else setLoading(true);setError("");try{const result=await api<unknown>("/api/price-tables");setTables(normalizeTables(result));}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível carregar as tabelas.");}finally{setLoading(false);setRefreshing(false);}},[]);
  useEffect(()=>{if(status!=="authenticated")return;const timer=setTimeout(()=>{void loadTables();},0);return()=>clearTimeout(timer);},[loadTables,status]);

  useEffect(()=>{
    if(!selected)return;
    let active=true;
    const timer=setTimeout(()=>{setLoading(true);setError("");fetchProducts(selected,query,1).then(result=>{if(active){setProducts(result.products);setProductTotal(result.total);}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Não foi possível carregar os produtos.");}).finally(()=>{if(active)setLoading(false);});},query.trim()?250:0);
    return()=>{active=false;clearTimeout(timer);};
  },[query,selected]);

  const visibleProducts=useMemo(()=>{const term=query.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");return term?products.filter(item=>`${item.code} ${item.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(term)):products;},[products,query]);
  const visibleTables=useMemo(()=>{const term=tableQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");return term?tables.filter(item=>`${item.description} ${item.companyName}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(term)):tables;},[tableQuery,tables]);
  const subtitle=useMemo(()=>selected?`${visibleProducts.length}${productTotal>visibleProducts.length?` de ${productTotal}`:""} produto(s)`: `${visibleTables.length}${tableQuery?` de ${tables.length}`:""} tabela(s) liberada(s)`,[productTotal,selected,tableQuery,tables.length,visibleProducts.length,visibleTables.length]);
  if(status==="anonymous")return <Redirect href="/login"/>;
  if(status==="unavailable")return <Redirect href="/"/>;

  async function sharePdf(){
    if(!selected)return;
    setSharing(true);
    let previewWindow: Window | null = null;
    try{
      if(useMockApi){
        if(Platform.OS==="web"){
          previewWindow=window.open("", "_blank");
          if(!previewWindow)throw new Error("O navegador bloqueou a abertura do PDF. Libere os pop-ups e tente novamente.");
          previewWindow.document.title="Gerando PDF...";
          previewWindow.document.body.innerHTML="<p style='font:16px sans-serif;padding:24px'>Gerando PDF de exemplo...</p>";
        }
        const allProducts=(await fetchProducts(selected,"",1)).products;
        const pdf=buildMockPriceTablePdf(selected,allProducts);
        if(Platform.OS==="web"){
          const url=URL.createObjectURL(new Blob([pdf],{type:"application/pdf"}));
          previewWindow!.location.href=url;
          setTimeout(()=>URL.revokeObjectURL(url),60_000);
          setDialog({title:"PDF de exemplo aberto",message:"A tabela completa foi aberta em uma nova guia. Este é o arquivo de demonstração que poderá ser enviado ao cliente.",tone:"success"});
          return;
        }
        const target=`${FileSystem.cacheDirectory}tabela-preco-${selected.id}-mock.pdf`;
        await FileSystem.writeAsStringAsync(target,pdf,{encoding:FileSystem.EncodingType.UTF8});
        if(!await Sharing.isAvailableAsync())throw new Error("O compartilhamento não está disponível neste aparelho.");
        await Sharing.shareAsync(target,{mimeType:"application/pdf",dialogTitle:`Compartilhar ${selected.description}`,UTI:"com.adobe.pdf"});
        return;
      }
      if(Platform.OS==="web")throw new Error("A visualização do PDF oficial está disponível no aplicativo instalado.");
      const resource=authenticatedResource((`/api/price-tables/${selected.id}/pdf`) as `/api/${string}`);
      const target=`${FileSystem.cacheDirectory}tabela-preco-${selected.id}.pdf`;
      const result=await FileSystem.downloadAsync(resource.url,target,{headers:resource.headers});
      if(result.status<200||result.status>=300)throw new Error(result.status===404?"O PDF oficial desta tabela ainda não está disponível na retaguarda.":"Não foi possível baixar o PDF da tabela.");
      if(!await Sharing.isAvailableAsync())throw new Error("O compartilhamento não está disponível neste aparelho.");
      await Sharing.shareAsync(result.uri,{mimeType:"application/pdf",dialogTitle:`Compartilhar ${selected.description}`,UTI:"com.adobe.pdf"});
    }catch(cause){previewWindow?.close();setDialog({title:"Não foi possível abrir o PDF",message:cause instanceof Error?cause.message:"Não foi possível compartilhar a tabela.",tone:"error"});}
    finally{setSharing(false);}
  }

  async function loadMoreProducts(){if(!selected||loading||loadingMore||products.length>=productTotal)return;setLoadingMore(true);try{const page=Math.floor(products.length/200)+1;const result=await fetchProducts(selected,query,page);setProducts(current=>Array.from(new Map([...current,...result.products].map(item=>[item.id,item])).values()));setProductTotal(result.total);}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível carregar mais produtos.");}finally{setLoadingMore(false);}}

  function back(){if(selected){setSelected(null);setProducts([]);setProductTotal(0);setQuery("");setError("");}else router.back();}

  return <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
    <View style={styles.header}><Pressable accessibilityLabel="Voltar" onPress={back} style={styles.back}><AppIcon name="arrow-back" color={colors.ink} size={22}/></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>CONSULTA COMERCIAL</Text><Text style={styles.title}>{selected?selected.description:"Tabelas de preço"}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>{selected?<Pressable accessibilityLabel="Compartilhar PDF" disabled={sharing} onPress={()=>void sharePdf()} style={[styles.pdf,sharing&&styles.disabled]}>{sharing?<ActivityIndicator color="#FFF"/>:<AppIcon name="share-social-outline" color="#FFF" size={21}/>}<Text style={styles.pdfText}>PDF</Text></Pressable>:null}</View>

    <View style={styles.searchWrap}><AppIcon name="search" color={colors.muted} size={19}/><TextInput value={selected?query:tableQuery} onChangeText={selected?setQuery:setTableQuery} autoCapitalize="none" autoCorrect={false} placeholder={selected?"Digite o código ou nome do produto":"Buscar tabela ou indústria"} placeholderTextColor="#8A99AA" style={styles.search}/>{(selected?query:tableQuery)?<Pressable accessibilityLabel="Limpar busca" onPress={()=>selected?setQuery(""):setTableQuery("")}><AppIcon name="close-circle" color={colors.muted} size={21}/></Pressable>:null}</View>
    {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>:null}

    {loading&&!(selected?products.length:tables.length)?<LoadingState label={selected?"Buscando produtos e preços…":"Carregando suas tabelas…"}/>:selected?
      <FlatList data={visibleProducts} keyExtractor={item=>String(item.id)} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" onEndReached={()=>void loadMoreProducts()} onEndReachedThreshold={.35} ListFooterComponent={loadingMore?<ActivityIndicator color={colors.brand} style={styles.more}/>:null} ListEmptyComponent={<EmptyState title="Nenhum produto encontrado" description="Apague a busca ou tente parte do código ou da descrição."/>} renderItem={({item})=><View style={styles.product}><View style={styles.productCopy}><Text style={styles.productName}>{item.name}</Text><Text style={styles.productMeta}>{[item.code,item.unit].filter(Boolean).join("  •  ")}</Text></View><View style={styles.priceWrap}><Text style={styles.priceLabel}>PREÇO</Text><Text style={styles.price}>{money(item.price)}</Text>{item.priceWithIpi!=null&&item.priceWithIpi!==item.price?<Text style={styles.ipi}>{money(item.priceWithIpi)} c/ IPI</Text>:null}</View></View>}/>
      :error&&!tables.length?<ErrorState message={error} onRetry={()=>void loadTables()}/>:<FlatList data={visibleTables} keyExtractor={item=>String(item.id)} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void loadTables(true)} colors={[colors.brand]}/>} ListEmptyComponent={<EmptyState title={tableQuery?"Nenhuma tabela encontrada":"Nenhuma tabela liberada"} description={tableQuery?"Tente outro nome de tabela ou indústria.":"Peça à retaguarda para associar uma tabela de preço ao seu usuário."}/>} renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>setSelected(item)} style={({pressed})=>[styles.table,pressed&&styles.pressed]}><View style={styles.tableIcon}><AppIcon name="pricetag-outline" color={colors.brand} size={24}/></View><View style={styles.tableCopy}><Text style={styles.tableName}>{item.description}</Text><Text style={styles.company}>{item.companyName}</Text><Text style={styles.tableMeta}>{[item.payment,item.freight&&`Frete ${item.freight}`,item.minimum?`Mínimo ${money(item.minimum)}`:""].filter(Boolean).join("  •  ")}</Text></View><AppIcon name="chevron-forward" color="#91A1B4" size={20}/></Pressable>}/>}
    <FeedbackDialog visible={Boolean(dialog)} title={dialog?.title || "Aviso"} message={dialog?.message || ""} tone={dialog?.tone} onClose={()=>setDialog(null)}/>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.canvas},header:{flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:16,paddingVertical:14,backgroundColor:colors.surface,borderBottomWidth:1,borderBottomColor:colors.border},back:{width:42,height:42,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#EDF3F7"},headerCopy:{flex:1},eyebrow:{color:colors.brandDark,fontSize:9,fontWeight:"900",letterSpacing:1.2},title:{color:colors.ink,fontSize:21,fontWeight:"900",marginTop:2},subtitle:{color:colors.muted,fontSize:11,marginTop:3},pdf:{height:43,flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:13,borderRadius:13,backgroundColor:colors.brand},pdfText:{color:"#FFF",fontSize:11,fontWeight:"900"},disabled:{opacity:.55},searchWrap:{height:54,flexDirection:"row",alignItems:"center",gap:10,margin:16,marginBottom:6,paddingHorizontal:14,borderRadius:16,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},search:{flex:1,color:colors.ink,fontSize:14},error:{marginHorizontal:16,marginTop:10,padding:12,borderRadius:12,backgroundColor:"#FEF2F2"},errorText:{color:colors.danger,fontSize:12,lineHeight:18},list:{padding:16,paddingBottom:36,flexGrow:1,gap:10},more:{paddingVertical:18},table:{flexDirection:"row",alignItems:"center",padding:15,borderRadius:18,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},pressed:{opacity:.72},tableIcon:{width:48,height:48,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:"#E8F3FB"},tableCopy:{flex:1,marginHorizontal:13},tableName:{color:colors.ink,fontSize:16,fontWeight:"900"},company:{color:colors.brandDark,fontSize:12,fontWeight:"700",marginTop:3},tableMeta:{color:colors.muted,fontSize:10,lineHeight:15,marginTop:6},product:{flexDirection:"row",alignItems:"center",gap:12,padding:15,borderRadius:17,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},productCopy:{flex:1},productName:{color:colors.ink,fontSize:13,lineHeight:18,fontWeight:"900"},productMeta:{color:colors.muted,fontSize:11,marginTop:5},priceWrap:{alignItems:"flex-end",minWidth:88},priceLabel:{color:colors.muted,fontSize:8,fontWeight:"900",letterSpacing:.7},price:{color:colors.brandDark,fontSize:17,fontWeight:"900",marginTop:3},ipi:{color:colors.muted,fontSize:9,marginTop:3},
});
