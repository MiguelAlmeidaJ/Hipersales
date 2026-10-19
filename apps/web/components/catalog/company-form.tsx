"use client";
import { useEffect,useState,type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthenticatedUser } from "@/components/auth/session-context";

type Company = {id:number;name:string;legal_name?:string;active?:boolean|number;lead_time_days?:number;[key:string]:unknown};
const fields = [
  ["name","Nome de identificação"],["legal_name","Razão social"],["trade_name","Nome fantasia"],
  ["cnpj","CNPJ"],["state_registration","Inscrição estadual"],["tax_regime","Regime fiscal"],
  ["address","Logradouro"],["address_number","Número"],["address_complement","Complemento"],
  ["district","Bairro"],["city","Município"],["state","UF"],["postal_code","CEP"],
  ["phone","Telefone"],["email","E-mail"],["website","Site"]
] as const;
type Key=typeof fields[number][0];
type Form = Record<Key,string> & {lead_time_days:string;active:boolean};
const initial:Form={name:"",legal_name:"",trade_name:"",cnpj:"",state_registration:"",tax_regime:"",
  address:"",address_number:"",address_complement:"",district:"",city:"",state:"",
  postal_code:"",phone:"",email:"",website:"",lead_time_days:"0",active:true};
const inputClass="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-[#0767b4] focus:ring-2 focus:ring-blue-100";
export default function CompanyForm({id}:{id?:number}){
  useAuthenticatedUser();
  const router=useRouter();
  const [form,setForm]=useState<Form>(initial);
  const [busy,setBusy]=useState(false),[looking,setLooking]=useState(false),[loading,setLoading]=useState(Boolean(id));
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  useEffect(()=>{
    if(!id)return;
    let mounted=true;
    api<{companies:Company[]}>("/api/admin/companies").then(result=>{
      const company=result.companies.find(x=>x.id===id);
      if(!company)throw new Error("Empresa não encontrada.");
      if(mounted)setForm({...initial,...Object.fromEntries(fields.map(([key])=>[key,String(company[key]??"")])),
        lead_time_days:String(company.lead_time_days??0),active:Boolean(company.active)});
    }).catch(err=>{if(mounted)setError(err instanceof Error?err.message:"Erro ao carregar empresa.");})
      .finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[id]);
  async function lookup(){
    const cnpj=form.cnpj.replace(/\D/g,"");
    if(cnpj.length!==14){setError("Informe os 14 dígitos do CNPJ.");return;}
    setLooking(true);setError("");setNotice("");
    try{
      const result=await api<{company:Partial<Record<Key,string>>}>("/api/admin/companies/lookup-cnpj?cnpj="+cnpj);
      setForm(old=>({...old,...Object.fromEntries(Object.entries(result.company).filter(([,v])=>Boolean(v))),cnpj:old.cnpj}));
      setNotice("Dados encontrados. Revise antes de salvar: inscrição estadual e regime fiscal devem ser preenchidos manualmente.");
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível consultar o CNPJ.");}
    finally{setLooking(false);}
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    try{
      await api((id?`/api/admin/companies/${id}`:"/api/admin/companies") as `/api/${string}`,{
        method:id?"PATCH":"POST",
        body:JSON.stringify({...form,lead_time_days:Number(form.lead_time_days||0)})
      });
      router.push("/app/empresas");router.refresh();
    }catch(err){setError(err instanceof Error?err.message:"Não foi possível salvar.");}
    finally{setBusy(false);}
  }
  if(loading)return <p className="p-6 text-sm text-slate-500">Carregando empresa...</p>;
  return <main className="mx-auto max-w-5xl space-y-6 pb-12">
    <header className="flex flex-wrap items-start justify-between gap-3"><div>
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#0767b4]">Cadastro de fornecedores</p>
      <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{id?"Editar empresa":"Nova empresa"}</h1>
      <p className="mt-1 text-sm text-slate-500">Mantenha os dados cadastrais, fiscais e logísticos atualizados.</p>
    </div><Link href="/app/empresas" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">Voltar às empresas</Link></header>
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5"><h2 className="text-base font-bold text-slate-900">Identificação da empresa</h2><p className="text-sm text-slate-500">Use a consulta de CNPJ para preencher os dados disponíveis.</p></div>
        <div className="mb-5 flex flex-wrap items-end gap-3"><label className="min-w-64 flex-1 text-sm font-semibold text-slate-700">CNPJ<input className={inputClass+" mt-1.5"} value={form.cnpj} onChange={e=>setForm(x=>({...x,cnpj:e.target.value}))} maxLength={18} placeholder="00.000.000/0000-00"/></label>
        <button type="button" disabled={looking||busy} onClick={()=>void lookup()} className="rounded-xl border border-[#0767b4] px-5 py-3 text-sm font-bold text-[#0767b4] disabled:opacity-50">{looking?"Consultando...":"Buscar dados do CNPJ"}</button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.filter(([k])=>!["cnpj","address","address_number","address_complement","district","city","state","postal_code","phone","email","website"].includes(k)).map(([key,label])=><label key={key} className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}<input required={key==="name"} className={inputClass} value={form[key]} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}/></label>)}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="mb-5 text-base font-bold text-slate-900">Endereço e contato</h2><div className="grid gap-4 sm:grid-cols-2">
        {fields.filter(([k])=>["address","address_number","address_complement","district","city","state","postal_code","phone","email","website"].includes(k)).map(([key,label])=><label key={key} className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}<input className={inputClass} type={key==="email"?"email":"text"} value={form[key]} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}/></label>)}
      </div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="mb-5 text-base font-bold text-slate-900">Operação</h2><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Lead time em dias<input type="number" min={0} max={3650} className={inputClass} value={form.lead_time_days} onChange={e=>setForm(x=>({...x,lead_time_days:e.target.value}))}/></label><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Situação<select className={inputClass} value={form.active?"active":"inactive"} onChange={e=>setForm(x=>({...x,active:e.target.value==="active"}))}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></label></div></section>
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice&&<p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700">{notice}</p>}
      <div className="flex flex-wrap justify-end gap-3"><Link href="/app/empresas" className="rounded-xl border border-slate-200 px-6 py-3 font-semibold">Cancelar</Link><button type="submit" disabled={busy||looking} className="rounded-xl bg-[#0767b4] px-6 py-3 font-bold text-white disabled:opacity-50">{busy?"Salvando...":id?"Salvar alterações":"Cadastrar empresa"}</button></div>
    </form>
  </main>;
}
