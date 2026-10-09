"use client";
import { useState, type FormEvent } from "react";

const reportTypes=[["vendas","Vendas"],["pedidos","Pedidos"],["clientes","Clientes"],["produtos","Produtos"],["representantes","Representantes"]] as const;
export default function ReportsView(){
 const [kind,setKind]=useState("vendas"),[start,setStart]=useState(""),[end,setEnd]=useState("");
 const [seller,setSeller]=useState(""),[company,setCompany]=useState(""),[customer,setCustomer]=useState(""),[status,setStatus]=useState("");
 const [url,setUrl]=useState("");
 function exportPdf(e:FormEvent){e.preventDefault();const q=new URLSearchParams({type:kind});
 if(start)q.set("date_from",start);if(end)q.set("date_to",end);
 if(seller)q.set("seller_id",seller);if(company)q.set("company_id",company);
 if(customer)q.set("customer_id",customer);if(status)q.set("status",status);
 setUrl(`/api/admin/reports/pdf?${q.toString()}`);}
 const field="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5";
 return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-2 text-xl font-semibold">Relatórios</h2>
 <p className="mb-5 text-sm text-slate-500">Os arquivos são gerados pela API atual, preservando a lógica de cálculo do backend.</p>
 <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={exportPdf}>
 <label className="grid gap-1 text-sm">Relatório<select className={field} value={kind} onChange={e=>setKind(e.target.value)}>{reportTypes.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
 <label className="grid gap-1 text-sm">Data inicial<input className={field} type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
 <label className="grid gap-1 text-sm">Data final<input className={field} type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
 <label className="grid gap-1 text-sm">ID do representante<input className={field} type="number" min="1" value={seller} onChange={e=>setSeller(e.target.value)}/></label>
 <label className="grid gap-1 text-sm">ID da empresa<input className={field} type="number" min="1" value={company} onChange={e=>setCompany(e.target.value)}/></label>
 <label className="grid gap-1 text-sm">ID do cliente<input className={field} type="number" min="1" value={customer} onChange={e=>setCustomer(e.target.value)}/></label>
 <label className="grid gap-1 text-sm">Status<input className={field} value={status} onChange={e=>setStatus(e.target.value)}/></label>
 <div className="flex items-end"><button type="submit" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white">Preparar PDF</button></div></form>
 {url&&<p className="mt-5 rounded-lg bg-slate-50 p-4"><a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">Abrir relatório em PDF</a></p>}
 </section>;
}
