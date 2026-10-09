"use client";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
export default function PasswordChange({required=false,onSuccess}:{required?:boolean;onSuccess:()=>void}){
 const [open,setOpen]=useState(required),[current,setCurrent]=useState(""),[next,setNext]=useState(""),[again,setAgain]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function submit(e:FormEvent){e.preventDefault();setError("");setNotice("");
 if(next.length<8){setError("A senha deve ter ao menos 8 caracteres.");return;}
 if(next!==again){setError("As novas senhas não coincidem.");return;}
 setBusy(true);
 try{await api("/api/me/password",{method:"POST",body:JSON.stringify({current_password:current,new_password:next})});setCurrent("");setNext("");setAgain("");setNotice("Senha atualizada.");onSuccess();if(!required)setOpen(false);}
 catch(e){setError(e instanceof Error?e.message:"Não foi possível alterar a senha")}finally{setBusy(false)}}
 return <section className="rounded-xl border border-slate-200 bg-white p-4">
 {!required&&<button type="button" className="text-sm font-semibold text-blue-700" onClick={()=>setOpen(v=>!v)}>{open?"Fechar alteração de senha":"Alterar minha senha"}</button>}
 {open&&<form onSubmit={submit} className="mt-3 grid max-w-md gap-3"><h2 className="text-lg font-semibold">{required?"Atualização obrigatória de senha":"Alterar senha"}</h2>
 {!required&&<label className="grid gap-1 text-sm">Senha atual<input className="rounded-lg border p-2" type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></label>}
 <label className="grid gap-1 text-sm">Nova senha<input className="rounded-lg border p-2" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={e=>setNext(e.target.value)}/></label>
 <label className="grid gap-1 text-sm">Repita a nova senha<input className="rounded-lg border p-2" type="password" autoComplete="new-password" required minLength={8} value={again} onChange={e=>setAgain(e.target.value)}/></label>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
 <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?"Salvando…":"Salvar nova senha"}</button>
 </form>}</section>;
}
