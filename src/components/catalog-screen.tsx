import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { Card, Input, ModulePage, Notice, PrimaryButton, SecondaryButton, Sheet, StatusPill } from "@/components/module-ui";
import { SelectField } from "@/components/form-controls";
import { EmptyState, LoadingState } from "@/components/list-states";
import { colors } from "@/constants/colors";
import { api, authenticatedResource } from "@/lib/api";

type Kind = "companies" | "products";
type Item = { id: number; name: string; legal_name?: string; active?: boolean | number; company_id?: number; company_name?: string; code?: string; product_group?: string | null; subgroup?: string | null; unit?: string; brand?: string | null; minimum_sale_quantity?: number; weight?: number; ncm?: string | null; ipi_percent?: number; has_st?: boolean | number; invoice_origin?: string | null; price?: number; lead_time_days?: number; trade_name?: string; cnpj?: string; state_registration?: string; tax_regime?: string; address?: string; address_number?: string; address_complement?: string; district?: string; city?: string; state?: string; postal_code?: string; phone?: string; email?: string; website?: string; };
type Form = { name: string; legal_name: string; company_id: string; code: string; product_group: string; subgroup: string; unit: string; brand: string; minimum_sale_quantity: string; weight: string; ncm: string; ipi_percent: string; has_st: boolean; invoice_origin: string; price: string; active: boolean; lead_time_days: string; trade_name: string; cnpj: string; state_registration: string; tax_regime: string; address: string; address_number: string; address_complement: string; district: string; city: string; state: string; postal_code: string; phone: string; email: string; website: string; };
const empty: Form = { name: "", legal_name: "", company_id: "", code: "", product_group: "", subgroup: "", unit: "UN", brand: "", minimum_sale_quantity: "0", weight: "0", ncm: "", ipi_percent: "0", has_st: false, invoice_origin: "", price: "0", active: true, lead_time_days:"0", trade_name: "", cnpj: "", state_registration: "", tax_regime: "", address: "", address_number: "", address_complement: "", district: "", city: "", state: "", postal_code: "", phone: "", email: "", website: "", };

export function CatalogScreen({ kind }: { kind: Kind }) {
  const isProduct = kind === "products";
  const [items, setItems] = useState<Item[]>([]), [companies, setCompanies] = useState<Item[]>([]);
  const [query, setQuery] = useState(""), [form, setForm] = useState<Form>(empty), [editing, setEditing] = useState<number | null>(null), [modal, setModal] = useState(false);
  const [lookupBusy,setLookupBusy]=useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const endpoint = isProduct ? "/api/admin/products" : "/api/admin/companies";
  const load = useCallback(async () => { const requests = [api<{ companies?: Item[]; products?: Item[] }>(endpoint)] as const; const [result, companyResult] = await Promise.all([requests[0], isProduct ? api<{ companies: Item[] }>("/api/admin/companies") : Promise.resolve({ companies: [] })]); setItems(result[kind] ?? []); setCompanies(companyResult.companies ?? []); }, [endpoint, isProduct, kind]);
  useEffect(() => { let active = true; const timer = setTimeout(() => { load().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar catálogo."); }).finally(() => { if (active) setLoading(false); }); }, 0); return () => { active = false; clearTimeout(timer); }; }, [load]);
  const filtered = useMemo(() => { const term = query.trim().toLocaleLowerCase("pt-BR"); return items.filter((item) => !term || [item.name, item.legal_name, item.trade_name, item.cnpj, item.code, item.company_name].join(" ").toLocaleLowerCase("pt-BR").includes(term)); }, [items, query]);
  function open(item?: Item) { setEditing(item?.id ?? null); setModal(true); setError(""); setNotice(""); setForm(item ? { name: item.name, legal_name: item.legal_name ?? "", company_id: String(item.company_id ?? ""), code: item.code ?? "", product_group: item.product_group ?? "", subgroup: item.subgroup ?? "", unit: item.unit ?? "UN", brand: item.brand ?? "", minimum_sale_quantity: String(item.minimum_sale_quantity ?? 0), weight: String(item.weight ?? 0), ncm: item.ncm ?? "", ipi_percent: String(item.ipi_percent ?? 0), has_st: Boolean(item.has_st), invoice_origin: item.invoice_origin ?? "", price: String(item.price ?? 0), active: Boolean(item.active), lead_time_days:String(item.lead_time_days??0), trade_name:item.trade_name??"", cnpj:item.cnpj??"", state_registration:item.state_registration??"", tax_regime:item.tax_regime??"", address:item.address??"", address_number:item.address_number??"", address_complement:item.address_complement??"", district:item.district??"", city:item.city??"", state:item.state??"", postal_code:item.postal_code??"", phone:item.phone??"", email:item.email??"", website:item.website??"", } : { ...empty }); }
  function close() { setModal(false); setEditing(null); setForm({ ...empty }); }
  async function save() { if (!form.name.trim() || (isProduct && (!form.company_id || !form.code.trim()))) { setError("Preencha os campos obrigatórios."); return; } setBusy(true); setError(""); try { const payload = isProduct ? { company_id: Number(form.company_id), code: form.code, name: form.name, product_group: form.product_group || null, subgroup: form.subgroup || null, unit: form.unit, brand: form.brand || null, minimum_sale_quantity: Number(form.minimum_sale_quantity || 0), weight: Number(form.weight || 0), ncm: form.ncm || null, ipi_percent: Number(form.ipi_percent || 0), has_st: form.has_st, invoice_origin: form.invoice_origin || null, price: Number(form.price || 0), active: form.active } : { name: form.name, legal_name: form.legal_name || null, lead_time_days:Number(form.lead_time_days||0), trade_name:form.trade_name||null, cnpj:form.cnpj||null, state_registration:form.state_registration||null, tax_regime:form.tax_regime||null, address:form.address||null, address_number:form.address_number||null, address_complement:form.address_complement||null, district:form.district||null, city:form.city||null, state:form.state||null, postal_code:form.postal_code||null, phone:form.phone||null, email:form.email||null, website:form.website||null, active: form.active }; await api(`${endpoint}${editing === null ? "" : `/${editing}`}` as `/api/${string}`, { method: editing === null ? "POST" : "PATCH", body: JSON.stringify(payload) }); await load(); setNotice(`${isProduct ? "Produto" : "Empresa"} salvo(a) com sucesso.`); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar."); } finally { setBusy(false); } }
  async function lookupCnpj(){
    const cnpj=form.cnpj.replace(/\D/g,"");
    if(cnpj.length!==14){setError("Informe um CNPJ válido com 14 números.");return;}
    setLookupBusy(true);setError("");
    try{
      const result=await api<{company:Record<string,string>}>(`/api/admin/companies/lookup-cnpj?cnpj=${cnpj}`);
      setForm(current=>({...current,...Object.fromEntries(Object.entries(result.company).filter(([,v])=>Boolean(v))),cnpj:current.cnpj}));
      setNotice("Dados consultados. Confira os campos fiscais antes de salvar.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Consulta indisponível.");}
    finally{setLookupBusy(false);}
  }
  async function downloadCompanyPdf(){
    if(!editing||isProduct)return;
    try{
      const resource=authenticatedResource(("/api/admin/companies/"+editing+"/pdf") as never);
      if(!resource.headers.Authorization)throw new Error("Sessão expirada.");
      const result=await FileSystem.downloadAsync(resource.url,FileSystem.cacheDirectory+"ficha-empresa-"+editing+".pdf",{headers:resource.headers});
      if(result.status!==200)throw new Error("Não foi possível baixar a ficha.");
      await Sharing.shareAsync(result.uri,{mimeType:"application/pdf"});
    }catch(cause){Alert.alert("Ficha de cadastro",cause instanceof Error?cause.message:"Falha ao baixar PDF.");}
  }
  async function remove(item: Item) { setBusy(true); setError(""); try { await api(`${endpoint}/${item.id}` as `/api/${string}`, { method: "DELETE" }); await load(); setNotice("Registro excluído."); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao excluir."); } finally { setBusy(false); } }
  return <ModulePage title={isProduct ? "Produtos" : "Empresas"} subtitle={isProduct ? "Catálogo comercial, preços e dados fiscais." : "Indústrias representadas e situação cadastral."}>
    <View style={styles.toolbar}><View style={styles.searchWrap}><AppIcon name="search" color={colors.muted} size={19}/><TextInput accessibilityLabel="Buscar" value={query} onChangeText={setQuery} placeholder="Buscar no catálogo" placeholderTextColor="#91A0AF" style={styles.search}/></View><Pressable accessibilityLabel={`Novo ${isProduct ? "produto" : "empresa"}`} onPress={() => open()} style={styles.add}><AppIcon name="add" color="#FFF" size={25}/></Pressable></View>
    {notice ? <Notice>{notice}</Notice> : null}{error && editing === null ? <Notice tone="error">{error}</Notice> : null}
    {loading ? <LoadingState /> : filtered.length === 0 ? <EmptyState title="Nenhum registro" description="Ajuste a busca ou cadastre um novo item."/> : filtered.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => open(item)}><Card style={styles.row}><View style={styles.icon}><AppIcon name={isProduct ? "cube-outline" : "business-outline"} color={colors.brand} size={23}/></View><View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{isProduct ? `${item.code || "Sem código"} · ${item.company_name || "Sem empresa"}` : [item.legal_name||"Razão social não informada",item.cnpj].filter(Boolean).join(" · ")}</Text><StatusPill active={Boolean(item.active)}/></View><AppIcon name="chevron-forward" color="#94A3B8" size={20}/></Card></Pressable>)}
    <Sheet visible={modal} title={`${editing === null ? "Novo" : "Editar"} ${isProduct ? "produto" : "empresa"}`} onClose={close}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {isProduct ? <SelectField label="Empresa *" value={form.company_id} onChange={(value) => setForm((x) => ({...x, company_id: value}))} searchable options={companies.map((x) => ({ value: String(x.id), label: x.name }))}/> : null}
      {isProduct ? <Input label="Código *" value={form.code} onChangeText={(value) => setForm((x) => ({...x, code: value}))}/> : null}
      <Input label={isProduct ? "Descrição *" : "Nome *"} value={form.name} onChangeText={(value) => setForm((x) => ({...x, name: value}))}/>
      {!isProduct ? <>
        <Input label="CNPJ" keyboardType="numeric" value={form.cnpj} onChangeText={value=>setForm(x=>({...x,cnpj:value}))}/>
        <SecondaryButton title={lookupBusy?"Consultando...":"Buscar dados pelo CNPJ"} disabled={busy||lookupBusy} onPress={()=>void lookupCnpj()}/>
        <Input label="Razão social" value={form.legal_name} onChangeText={value=>setForm(x=>({...x,legal_name:value}))}/>
        <Input label="Nome fantasia" value={form.trade_name} onChangeText={value=>setForm(x=>({...x,trade_name:value}))}/>
        <Input label="Inscrição estadual" value={form.state_registration} onChangeText={value=>setForm(x=>({...x,state_registration:value}))}/>
        <Input label="Regime fiscal" value={form.tax_regime} onChangeText={value=>setForm(x=>({...x,tax_regime:value}))}/>
        <Input label="Logradouro" value={form.address} onChangeText={value=>setForm(x=>({...x,address:value}))}/>
        <Input label="Número" value={form.address_number} onChangeText={value=>setForm(x=>({...x,address_number:value}))}/>
        <Input label="Complemento" value={form.address_complement} onChangeText={value=>setForm(x=>({...x,address_complement:value}))}/>
        <Input label="Bairro" value={form.district} onChangeText={value=>setForm(x=>({...x,district:value}))}/>
        <Input label="Município" value={form.city} onChangeText={value=>setForm(x=>({...x,city:value}))}/>
        <Input label="UF" value={form.state} onChangeText={value=>setForm(x=>({...x,state:value}))}/>
        <Input label="CEP" value={form.postal_code} onChangeText={value=>setForm(x=>({...x,postal_code:value}))}/>
        <Input label="Telefone" value={form.phone} onChangeText={value=>setForm(x=>({...x,phone:value}))}/>
        <Input label="E-mail" value={form.email} onChangeText={value=>setForm(x=>({...x,email:value}))}/>
        <Input label="Site" value={form.website} onChangeText={value=>setForm(x=>({...x,website:value}))}/>
        <Input label="Lead time (dias)" keyboardType="numeric" value={form.lead_time_days} onChangeText={value=>setForm(x=>({...x,lead_time_days:value}))}/>
      </> : null}
      {isProduct ? <><Input label="Grupo" value={form.product_group} onChangeText={(value) => setForm((x) => ({...x, product_group: value}))}/><Input label="Subgrupo" value={form.subgroup} onChangeText={(value) => setForm((x) => ({...x, subgroup: value}))}/><Input label="Unidade" value={form.unit} onChangeText={(value) => setForm((x) => ({...x, unit: value}))}/><Input label="Marca" value={form.brand} onChangeText={(value) => setForm((x) => ({...x, brand: value}))}/><Input label="Preço sugerido" keyboardType="decimal-pad" value={form.price} onChangeText={(value) => setForm((x) => ({...x, price: value}))}/><Input label="Quantidade mínima" keyboardType="decimal-pad" value={form.minimum_sale_quantity} onChangeText={(value) => setForm((x) => ({...x, minimum_sale_quantity: value}))}/><Input label="Peso" keyboardType="decimal-pad" value={form.weight} onChangeText={(value) => setForm((x) => ({...x, weight: value}))}/><Input label="NCM" value={form.ncm} onChangeText={(value) => setForm((x) => ({...x, ncm: value}))}/><Input label="IPI (%)" keyboardType="decimal-pad" value={form.ipi_percent} onChangeText={(value) => setForm((x) => ({...x, ipi_percent: value}))}/><Input label="Origem da nota" value={form.invoice_origin} onChangeText={(value) => setForm((x) => ({...x, invoice_origin: value}))}/><View style={styles.switchRow}><Text style={styles.switchLabel}>Substituição tributária (ST)</Text><Switch value={form.has_st} onValueChange={(value) => setForm((x) => ({...x, has_st: value}))}/></View></> : null}
      <View style={styles.switchRow}><Text style={styles.switchLabel}>Cadastro ativo</Text><Switch value={form.active} onValueChange={(value) => setForm((x) => ({...x, active: value}))}/></View>
      <PrimaryButton title="Salvar" onPress={() => void save()} busy={busy}/>{!isProduct && editing!==null?<SecondaryButton title="Compartilhar ficha PDF" onPress={()=>void downloadCompanyPdf()}/>:null}{editing !== null ? <SecondaryButton title="Excluir registro" danger disabled={busy} onPress={() => { const item = items.find((x) => x.id === editing); if (item) Alert.alert("Excluir registro", `Deseja excluir ${item.name}?`, [{text:"Cancelar",style:"cancel"},{text:"Excluir",style:"destructive",onPress:()=>void remove(item)}]); }}/> : null}
    </Sheet>
  </ModulePage>;
}
const styles = StyleSheet.create({ toolbar:{flexDirection:"row",gap:10,padding:16,paddingBottom:2},searchWrap:{flex:1,height:49,flexDirection:"row",alignItems:"center",gap:9,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,paddingHorizontal:13},search:{flex:1,color:colors.ink,fontSize:14},add:{width:49,height:49,borderRadius:15,alignItems:"center",justifyContent:"center",backgroundColor:colors.brand},row:{flexDirection:"row",alignItems:"center",marginTop:10},icon:{width:45,height:45,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"#E8F3FB"},copy:{flex:1,marginHorizontal:12,gap:4},name:{color:colors.ink,fontSize:14,fontWeight:"900"},meta:{color:colors.muted,fontSize:11},switchRow:{minHeight:50,flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:10},switchLabel:{color:colors.ink,fontSize:13,fontWeight:"800"} });
