"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
type Settings={smtp?:Record<string,unknown>;whatsapp?:Record<string,unknown>};
type Response={settings:Settings};
const css="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
const smtpFields=[["host","Servidor"],["port","Porta"],["username","Usuário"],["password","Senha"],["from_email","Remetente"]] as const;
const whatsappFields=[["enabled","Habilitado"],["instance_id","Instância"],["alert_phone","Telefone de alertas"]] as const;
export default function SettingsEditor(){
 const [settings,setSettings]=useState<Settings>({});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function reload(){const v=await api<Response>("/api/admin/settings");setSettings(v.settings||{});}
 useEffect(()=>{let active=true;api<Response>("/api/admin/settings").then(v=>{if(active)setSettings(v.settings||{})}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao consultar configurações")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 function update(section:"smtp"|"whatsapp",key:string,value:string|boolean){setSettings(s=>({...s,[section]:{...(s[section]||{}),[key]:value}}));}
 async function action(endpoint:`/api/${string}`,data:unknown){setBusy(true);setError("");setNotice("");try{const r=await api<{message?:string}>(endpoint,{method:"POST",body:JSON.stringify(data)});setNotice(r.message||"Operação executada.");await reload()}catch(e){setError(e instanceof Error?e.message:"Falha na operação")}finally{setBusy(false)}}
 function save(e:FormEvent,section:"smtp"|"whatsapp"){e.preventDefault();void action("/api/admin/settings",{section,data:settings[section]||{}})}
 if(loading)return <p role="status">Carregando configurações…</p>;
 return <section className="space-y-5"><header><h2 className="text-xl font-semibold">Configurações administrativas</h2><p className="text-sm text-slate-500">Integrações protegidas por autenticação administrativa no servidor.</p></header>
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{notice&&<p role="status" className="rounded-lg bg-green-50 p-3 text-green-700">{notice}</p>}
 <form onSubmit={e=>save(e,"smtp")} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">SMTP</h3>
 <div className="grid gap-4 sm:grid-cols-2">{smtpFields.map(([key,label])=><label className="grid gap-1.5 text-sm" key={key}>{label}<input className={css} type={key==="password"?"password":key==="port"?"number":"text"} value={String(settings.smtp?.[key]??"")} onChange={e=>update("smtp",key,key==="port"?String(e.target.value):e.target.value)}/></label>)}
 {(["use_ssl","use_tls"] as const).map(key=><label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(settings.smtp?.[key])} onChange={e=>update("smtp",key,e.target.checked)}/>{key==="use_ssl"?"SSL":"STARTTLS"}</label>)}</div>
 <div className="flex flex-wrap gap-3"><button disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-white">Salvar SMTP</button><button disabled={busy} type="button" onClick={()=>void action("/api/admin/settings/smtp/test",settings.smtp||{})} className="rounded-lg border px-4 py-2">Testar conexão</button></div></form>
 <form onSubmit={e=>save(e,"whatsapp")} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">WhatsApp — Evolution API</h3>
 <p className="text-sm text-slate-600">Status: {settings.whatsapp?.connected?"Conectado":String(settings.whatsapp?.status_label||"Desconectado")}</p>
 <div className="grid gap-4 sm:grid-cols-2">{whatsappFields.map(([key,label])=>key==="enabled"?<label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(settings.whatsapp?.enabled)} onChange={e=>update("whatsapp",key,e.target.checked)}/>{label}</label>:<label className="grid gap-1.5 text-sm" key={key}>{label}<input className={css} value={String(settings.whatsapp?.[key]??"")} onChange={e=>update("whatsapp",key,e.target.value)}/></label>)}</div>
 <div className="flex flex-wrap gap-3"><button disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-white">Salvar WhatsApp</button><button disabled={busy} type="button" className="rounded-lg border px-4 py-2" onClick={()=>{if(window.confirm("Iniciar uma nova conexão WhatsApp?"))void action("/api/admin/settings/whatsapp/connect",settings.whatsapp||{})}}>Conectar / gerar QR</button><button disabled={busy} type="button" className="rounded-lg border px-4 py-2 text-red-700" onClick={()=>{if(window.confirm("Desconectar instância WhatsApp?"))void action("/api/admin/settings/whatsapp/disconnect",{})}}>Desconectar</button><button type="button" className="rounded-lg border px-4 py-2" onClick={()=>void reload()}>Atualizar status</button></div>
 {typeof settings.whatsapp?.qr_image_url==="string"&&settings.whatsapp.qr_image_url.startsWith("data:image/")&&<img alt="QR Code para conectar WhatsApp" src={settings.whatsapp.qr_image_url} width={240} height={240}/>}</form>
 <p className="text-sm text-slate-500">Funis, modelos de mensagem e estágios configuráveis ainda precisam ser migrados antes da remoção do frontend antigo.</p></section>;
}
