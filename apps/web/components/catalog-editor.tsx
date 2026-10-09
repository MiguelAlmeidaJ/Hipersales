"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";

type Item = { id:number; name:string; legal_name?:string; active?:number|boolean; company_id?:number; code?:string; unit?:string; price?:number };
type Kind = "companies"|"products";

export function CatalogEditor({kind}:{kind:Kind}) {
 const [records,setRecords]=useState<Item[]>([]);
 const [companies,setCompanies]=useState<Item[]>([]);
 const [editing,setEditing]=useState<number|null>(null);
 const [form,setForm]=useState({name:"",legal_name:"",company_id:"",code:"",unit:"UN",price:"0",active:true});
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 const endpoint=kind==="companies"?"/api/admin/companies":"/api/admin/products";
 async function reload(){const data=await api<{companies?:Item[];products?:Item[]}>(endpoint);setRecords(data[kind]||[]);if(kind==="products"){const c=await api<{companies:Item[]}>("/api/admin/companies");setCompanies(c.companies||[])}}
 useEffect(()=>{let active=true;async function load(){try{const data=await api<{companies?:Item[];products?:Item[]}>(endpoint);if(active)setRecords(data[kind]||[]);if(kind==="products"){const c=await api<{companies:Item[]}>("/api/admin/companies");if(active)setCompanies(c.companies||[])}}catch(e){if(active)setError(e instanceof Error?e.message:"Falha ao carregar")}}void load();return()=>{active=false}},[endpoint,kind]);
 async function removeProduct(item:Item){
  if(kind!=="products"||!window.confirm(`Excluir o produto "${item.name}"? A API impedirá a exclusão se houver pedidos vinculados.`))return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api<{message?:string}>(`/api/admin/products/${item.id}`,{method:"DELETE"});
   await reload();if(editing===item.id)reset();setNotice(result.message||"Produto excluído.");
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível excluir o produto")}finally{setBusy(false)}
 }
 function reset(){setEditing(null);setForm({name:"",legal_name:"",company_id:"",code:"",unit:"UN",price:"0",active:true})}
 function edit(item:Item){setEditing(item.id);setForm({name:item.name,legal_name:item.legal_name||"",company_id:String(item.company_id??""),code:item.code||"",unit:item.unit||"UN",price:String(item.price??0),active:item.active===true||item.active===1})}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");setNotice("");
 try{
 const payload=kind==="companies"?{name:form.name,legal_name:form.legal_name,active:form.active}:{name:form.name,company_id:Number(form.company_id),code:form.code,unit:form.unit,price:Number(form.price),active:form.active};
 if(kind==="products"&&!form.company_id)throw new Error("Selecione a empresa.");
 await api(`${endpoint}${editing===null?"":"/"+editing}` as `/api/${string}`,{method:editing===null?"POST":"PATCH",body:JSON.stringify(payload)});
 await reload();reset();setNotice("Dados salvos com sucesso.");
 }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar")}finally{setBusy(false)}}
 return <section className="tile"><h2>{kind==="companies"?"Empresas":"Produtos"}</h2>
 <form onSubmit={submit} className="editor-form">
 <label>Nome<input required value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></label>
 {kind==="companies"?<label>Razão social<input value={form.legal_name} onChange={e=>setForm(x=>({...x,legal_name:e.target.value}))}/></label>:<>
 <label>Empresa<select required value={form.company_id} onChange={e=>setForm(x=>({...x,company_id:e.target.value}))}><option value="">Selecione</option>{companies.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
 <label>Código<input required value={form.code} onChange={e=>setForm(x=>({...x,code:e.target.value}))}/></label>
 <label>Unidade<input value={form.unit} onChange={e=>setForm(x=>({...x,unit:e.target.value}))}/></label>
 <label>Preço<input type="number" min="0" step="0.01" required value={form.price} onChange={e=>setForm(x=>({...x,price:e.target.value}))}/></label></>}
 <label className="checkbox-row"><input type="checkbox" checked={form.active} onChange={e=>setForm(x=>({...x,active:e.target.checked}))}/> Ativo</label>
 <button className="primary" disabled={busy} type="submit">{busy?"Salvando…":editing!==null?"Salvar alterações":"Cadastrar"}</button>
 {editing!==null&&<button type="button" className="secondary" onClick={reset}>Cancelar edição</button>}
 </form>{error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <div className="table-wrap"><table><thead><tr><th>ID</th><th>Nome</th>{kind==="products"&&<><th>Código</th><th>Preço</th></>}<th>Situação</th><th>Ações</th></tr></thead>
 <tbody>{records.map(x=><tr key={x.id}><td>{x.id}</td><td>{x.name}</td>{kind==="products"&&<><td>{x.code}</td><td>{x.price}</td></>}<td>{x.active?"Ativo":"Inativo"}</td><td><button type="button" className="secondary" onClick={()=>edit(x)}>Editar</button>{kind==="products"&&<button type="button" disabled={busy} className="ml-3 text-red-700" onClick={()=>void removeProduct(x)}>Excluir</button>}</td></tr>)}</tbody></table></div></section>;
}
