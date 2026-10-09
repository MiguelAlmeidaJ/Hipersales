"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import SellerAssignments from "./seller-assignments";
type User = {id:number;name:string;email:string;communication_email?:string;whatsapp_phone?:string;role:"admin"|"seller";active:boolean|number;is_super_admin?:boolean|number};
const initial={name:"",email:"",communication_email:"",whatsapp_phone:"",role:"seller",active:true,temporary_password:""};
export default function UsersEditor(){
 const [items,setItems]=useState<User[]>([]);
 const [form,setForm]=useState(initial);
 const [editing,setEditing]=useState<number|null>(null);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState("");
 const [assignmentSeller,setAssignmentSeller]=useState<User|null>(null);
 async function refresh(){const r=await api<{users:User[]}>("/api/admin/users");setItems(r.users||[])}
 useEffect(()=>{let alive=true;api<{users:User[]}>("/api/admin/users").then(r=>{if(alive)setItems(r.users||[])}).catch(e=>{if(alive)setError(String(e))});return()=>{alive=false}},[]);
 async function submit(e:FormEvent){e.preventDefault();setSaving(true);setError("");setNotice("");
 try{
 const path=(editing===null?"/api/admin/users":`/api/admin/users/${editing}`) as `/api/${string}`;
 const r=await api<{message:string}>(path,{method:editing===null?"POST":"PATCH",body:JSON.stringify(form)});
 await refresh();setEditing(null);setForm(initial);setNotice(r.message);
 }catch(e){setError(e instanceof Error?e.message:"Erro ao salvar")}finally{setSaving(false)}}
 function edit(u:User){setEditing(u.id);setForm({name:u.name,email:u.email,communication_email:u.communication_email||"",whatsapp_phone:u.whatsapp_phone||"",role:u.role,active:Boolean(u.active),temporary_password:""})}
 return <section className="space-y-6"><form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{editing===null?"Novo usuário":"Editar usuário"}</h2>
 <div className="grid gap-4 sm:grid-cols-2">
 {(["name","email","communication_email","whatsapp_phone","temporary_password"] as const).map(k=><label className="grid gap-1 text-sm" key={k}>{({name:"Nome",email:"Login",communication_email:"E-mail",whatsapp_phone:"WhatsApp",temporary_password:"Senha temporária"} as const)[k]}<input type={k==="temporary_password"?"password":"text"} required={k==="name"||k==="email"||(k==="temporary_password"&&editing===null)} className="rounded-lg border p-2.5" value={form[k]} onChange={e=>setForm(v=>({...v,[k]:e.target.value}))}/></label>)}
 <label className="grid gap-1 text-sm">Perfil<select className="rounded-lg border p-2.5" value={form.role} onChange={e=>setForm(v=>({...v,role:e.target.value}))}><option value="seller">Representante</option><option value="admin">Administrador</option></select></label>
 <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e=>setForm(v=>({...v,active:e.target.checked}))}/> Ativo</label>
 </div><button disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-white">Salvar usuário</button>{editing!==null&&<button type="button" className="ml-3 rounded-lg border px-4 py-2" onClick={()=>{setEditing(null);setForm(initial)}}>Cancelar</button>}
 {error&&<p className="text-red-700" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</form>
 <div className="overflow-x-auto rounded-xl border bg-white p-5"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Nome</th><th className="p-2">Login</th><th className="p-2">Perfil</th><th className="p-2">Situação</th><th className="p-2">Ações</th></tr></thead><tbody>{items.map(u=><tr key={u.id}><td className="border-t p-2">{u.name}</td><td className="border-t p-2">{u.email}</td><td className="border-t p-2">{u.role}</td><td className="border-t p-2">{u.active?"Ativo":"Inativo"}</td><td className="border-t p-2">{!u.is_super_admin&&<div className="flex gap-3"><button type="button" className="text-brand" onClick={()=>edit(u)}>Editar</button>{u.role==="seller"&&<button type="button" className="text-brand" onClick={()=>setAssignmentSeller(u)}>Carteira</button>}</div>}</td></tr>)}</tbody></table></div>{assignmentSeller&&<div className="mt-5"><button type="button" className="mb-3 rounded-lg border px-3 py-2" onClick={()=>setAssignmentSeller(null)}>Fechar carteira</button><SellerAssignments key={assignmentSeller.id} sellerId={assignmentSeller.id} sellerName={assignmentSeller.name}/></div>}</section>;
}
