"use client";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
type Order={id:number;status:string;admin_notes?:string;delivery_forecast?:string;industry_order_number?:string;invoice_number?:string;payment_terms?:string};
export default function OrderAdmin({order,onSaved}:{order:Order;onSaved:()=>void}){
 const [values,setValues]=useState({status:order.status,admin_notes:order.admin_notes||"",delivery_forecast:order.delivery_forecast||"",industry_order_number:order.industry_order_number||"",invoice_number:order.invoice_number||"",payment_terms:order.payment_terms||""});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
 try{const r=await api<{message?:string}>(`/api/admin/proposals/${order.id}`,{method:"PATCH",body:JSON.stringify(values)});setNotice(r.message||"Pedido atualizado");onSaved()}
 catch(e){setError(e instanceof Error?e.message:"Falha ao atualizar")}finally{setBusy(false)}}
 return <form onSubmit={submit} className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4"><h3 className="mb-3 font-semibold">Editar informações administrativas</h3><div className="grid gap-4 sm:grid-cols-2">
 <label className="grid gap-1 text-sm">Status<input className="rounded-lg border bg-white p-2.5" value={values.status} onChange={e=>setValues(v=>({...v,status:e.target.value}))} required/></label>
 {(["delivery_forecast","industry_order_number","invoice_number","payment_terms","admin_notes"] as const).map(key=><label className="grid gap-1 text-sm" key={key}>{({delivery_forecast:"Previsão de entrega",industry_order_number:"Nº indústria",invoice_number:"Nota fiscal",payment_terms:"Condição de pagamento",admin_notes:"Observações administrativas"} as const)[key]}<input className="rounded-lg border bg-white p-2.5" value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}
 </div>{error&&<p className="my-2 text-red-700" role="alert">{error}</p>}{notice&&<p className="my-2 text-green-700" role="status">{notice}</p>}<button disabled={busy} className="mt-4 rounded-lg bg-brand px-4 py-2 text-white">Salvar alterações</button></form>;
}
