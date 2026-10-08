"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api, type SessionUser } from "../lib/api";

type Customer = { id:number; legal_name:string; active?:number|boolean };
type Seller = { id:number; name:string; role:string; active?:number|boolean };
type Occurrence = { id:number; customer_id?:number; customer_name?:string; seller_name?:string; reason?:string; description?:string; status?:string; resolution?:string; created_at?:string };
type Attachment = {filename:string;mimetype:string;content:string};
const statuses=[["aberta","Aberta"],["em_analise","Em análise"],["recusada","Recusada"],["solucionada","Solucionada"]] as const;
async function toBase64(file:File):Promise<Attachment>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve({filename:file.name,mimetype:file.type||"application/octet-stream",content:String(reader.result).split(",")[1]||""});
  reader.onerror=()=>reject(new Error("Erro ao ler arquivo"));
  reader.readAsDataURL(file);
 });
}
export default function OccurrenceEditor({user}:{user:SessionUser}){
 const admin=user.role==="admin";
 const [rows,setRows]=useState<Occurrence[]>([]);
 const [customers,setCustomers]=useState<Customer[]>([]);
 const [sellers,setSellers]=useState<Seller[]>([]);
 const [form,setForm]=useState({customer_id:"",seller_id:"",reason:"",description:""});
 const [files,setFiles]=useState<File[]>([]);
 const [editing,setEditing]=useState<number|null>(null);
 const [status,setStatus]=useState("aberta");
 const [resolution,setResolution]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function load(){
  const [o,c]=await Promise.all([api<{occurrences:Occurrence[]}>("/api/occurrences"),api<{customers:Customer[]}>(admin?"/api/admin/customers":"/api/customers")]);
  setRows(o.occurrences||[]);setCustomers(c.customers||[]);
  if(admin){const u=await api<{users:Seller[]}>("/api/admin/users");setSellers((u.users||[]).filter(x=>x.role==="seller"&&Boolean(x.active)));}
 }
 useEffect(()=>{let active=true;async function init(){try{const [o,c]=await Promise.all([api<{occurrences:Occurrence[]}>("/api/occurrences"),api<{customers:Customer[]}>(admin?"/api/admin/customers":"/api/customers")]);if(!active)return;setRows(o.occurrences||[]);setCustomers(c.customers||[]);if(admin){const u=await api<{users:Seller[]}>("/api/admin/users");if(active)setSellers((u.users||[]).filter(x=>x.role==="seller"&&Boolean(x.active)))}}catch(e){if(active)setError(e instanceof Error?e.message:"Erro ao carregar")}}void init();return()=>{active=false}},[admin]);
 async function create(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   if(admin&&!form.seller_id)throw new Error("Selecione o representante.");
   const total=files.reduce((sum,f)=>sum+f.size,0);
   if(total>25*1024*1024)throw new Error("Anexos acima de 25 MB.");
   const attachments=await Promise.all(files.map(toBase64));
   const body={customer_id:Number(form.customer_id),reason:form.reason,description:form.description,attachments,...(admin?{seller_id:Number(form.seller_id)}:{})};
   const result=await api<{message?:string}>("/api/occurrences",{method:"POST",body:JSON.stringify(body)});
   await load();setFiles([]);setForm({customer_id:"",seller_id:"",reason:"",description:""});setNotice(result.message||"Ocorrência registrada.");
  }catch(e){setError(e instanceof Error?e.message:"Falha ao registrar")}finally{setBusy(false)}
 }
 async function saveStatus(){
  if(editing===null)return;setBusy(true);setError("");setNotice("");
  try{const result=await api<{message?:string}>(`/api/admin/occurrences/${editing}`,{method:"PATCH",body:JSON.stringify({status,resolution})});await load();setEditing(null);setNotice(result.message||"Status atualizado.");}
  catch(e){setError(e instanceof Error?e.message:"Falha ao atualizar")}finally{setBusy(false)}
 }
 return <section className="tile"><h2>Ocorrências</h2><form className="editor-form" onSubmit={create}>
  <label>Cliente<select required value={form.customer_id} onChange={e=>setForm(v=>({...v,customer_id:e.target.value}))}><option value="">Selecione</option>{customers.filter(c=>Boolean(c.active)).map(c=><option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></label>
  {admin&&<label>Representante<select required value={form.seller_id} onChange={e=>setForm(v=>({...v,seller_id:e.target.value}))}><option value="">Selecione</option>{sellers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  <label>Motivo<input required value={form.reason} onChange={e=>setForm(v=>({...v,reason:e.target.value}))}/></label>
  <label className="wide">Descrição<textarea required rows={3} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
  <label>Anexos (até 25 MB no total)<input type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label>
  <button type="submit" className="primary" disabled={busy}>{busy?"Enviando…":"Registrar ocorrência"}</button>
 </form>
 {error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <div className="table-wrap"><table><thead><tr><th>ID</th><th>Cliente</th><th>Motivo</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>{rows.map(o=><tr key={o.id}><td>{o.id}</td><td>{o.customer_name||o.customer_id||"—"}</td><td>{o.reason||"—"}</td><td>{o.status||"—"}</td><td>{o.created_at||"—"}</td><td>{admin&&<button type="button" className="secondary" onClick={()=>{setEditing(o.id);setStatus(o.status||"aberta");setResolution(o.resolution||"")}}>Atualizar</button>} <a href={`/api/admin/occurrences/${o.id}/pdf`} target="_blank" rel="noreferrer">PDF</a></td></tr>)}</tbody></table></div>
 {editing!==null&&admin&&<section className="tile"><h3>Atualizar ocorrência #{editing}</h3><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statuses.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label className="field">Resolução<textarea rows={3} value={resolution} onChange={e=>setResolution(e.target.value)}/></label><button type="button" className="primary" disabled={busy} onClick={saveStatus}>Salvar status</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancelar</button></section>}
 </section>;
}
