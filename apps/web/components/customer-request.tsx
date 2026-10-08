"use client";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

type Form = {
 legal_name:string;trade_name:string;cnpj:string;contact_person:string;phone_1:string;
 purchase_email:string;state_registration:string;address:string;notes:string;
};
const initial:Form={legal_name:"",trade_name:"",cnpj:"",contact_person:"",phone_1:"",purchase_email:"",state_registration:"",address:"",notes:""};
const entries:[keyof Form,string,boolean][]=[
 ["legal_name","Razão social",true],["trade_name","Nome fantasia",false],["cnpj","CNPJ",true],
 ["contact_person","Pessoa de contato",true],["phone_1","Telefone com DDD",true],
 ["purchase_email","E-mail de compras",false],["state_registration","Inscrição estadual",false],
 ["address","Endereço",false],["notes","Observações",false]
];
export default function CustomerRequest(){
 const [form,setForm]=useState<Form>(initial);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   const result=await api<{message?:string}>("/api/customer-requests",{method:"POST",body:JSON.stringify(form)});
   setForm(initial);setNotice(result.message||"Solicitação enviada.");
  }catch(e){setError(e instanceof Error?e.message:"Erro ao enviar solicitação");}finally{setBusy(false);}
 }
 return <section className="tile"><h2>Solicitar cadastro de cliente</h2><p>Os dados serão submetidos à validação existente no back office.</p>
 <form className="editor-form" onSubmit={submit}>
 {entries.map(([key,label,required])=><label key={key}>{label}<input required={required} value={form[key]} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}/></label>)}
 <button disabled={busy} className="primary">{busy?"Enviando…":"Enviar solicitação"}</button>
 </form>{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <p className="muted">Campos complementares de cadastro e consulta de CNPJ serão migrados em etapas seguintes.</p></section>;
}
