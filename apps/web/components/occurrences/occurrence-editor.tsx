"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, downloadApiFile, type SessionUser } from "@/lib/api";

type Customer = { id: number; legal_name: string; trade_name?: string; cnpj?: string; active?: number | boolean };
type Seller = { id: number; name: string; role: string; active?: number | boolean };
type Occurrence = {
  id: number;
  customer_id?: number;
  customer_name?: string;
  seller_name?: string;
  reason?: string;
  description?: string;
  status?: string;
  resolution?: string;
  created_at?: string;
  customer_cnpj?: string;
  attachments?: { id:number; filename:string; mimetype:string }[];
  timeline?: { id:number; title?:string; notes?:string; created_at?:string; created_by_name?:string }[];
};
type Attachment = { filename: string; mimetype: string; content: string };
const reasons = ["PRODUTO AVARIADO","DIVERGÊNCIA DE PRODUTO","DIVERGÊNCIA DE QUANTIDADE","FALTA DE PRODUTO NO PEDIDO","DIVERGÊNCIA DE PREÇOS","PROBLEMAS COM A NOTA FISCAL","PROBLEMAS COM O BOLETO","PAGAMENTO DE VERBAS","DESCONTOS NÃO CONCEDIDOS","DEVOLUÇÃO DE MERCADORIAS","ATRASO NA ENTREGA","CANCELAMENTO DE PEDIDO","OUTROS MOTIVOS"];
const statuses = [
  ["aberta", "Aberta"],
  ["em_analise", "Em análise"],
  ["recusada", "Recusada"],
  ["solucionada", "Solucionada"],
] as const;
async function toBase64(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        filename: file.name,
        mimetype: file.type || "application/octet-stream",
        content: String(reader.result).split(",")[1] || "",
      });
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
export default function OccurrenceEditor({ user, standalone = false }: { user: SessionUser; standalone?: boolean }) {
  const router=useRouter();
  const admin = user.role === "admin" || user.role === "dev";
  const [rows, setRows] = useState<Occurrence[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [form, setForm] = useState({ customer_id: "", seller_id: "", reason: "", description: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [showCreate,setShowCreate]=useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOpen,setCustomerOpen]=useState(false);
  const [status, setStatus] = useState("aberta");
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    const [o, c] = await Promise.all([
      api<{ occurrences: Occurrence[] }>("/api/occurrences"),
      api<{ customers: Customer[] }>(admin ? "/api/admin/customers" : "/api/customers"),
    ]);
    setRows(o.occurrences || []);
    setCustomers(c.customers || []);
    if (admin) {
      const u = await api<{ users: Seller[] }>("/api/admin/users");
      setSellers((u.users || []).filter((x) => x.role === "seller" && Boolean(x.active)));
    }
  }
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [o, c] = await Promise.all([
          api<{ occurrences: Occurrence[] }>("/api/occurrences"),
          api<{ customers: Customer[] }>(admin ? "/api/admin/customers" : "/api/customers"),
        ]);
        if (!active) return;
        setRows(o.occurrences || []);
        setCustomers(c.customers || []);
        if (admin) {
          const u = await api<{ users: Seller[] }>("/api/admin/users");
          if (active)
            setSellers((u.users || []).filter((x) => x.role === "seller" && Boolean(x.active)));
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Erro ao carregar");
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [admin]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if(!form.customer_id) throw new Error("Selecione o cliente na lista de resultados.");
      if (admin && !form.seller_id) throw new Error("Selecione o representante.");
      const total = files.reduce((sum, f) => sum + f.size, 0);
      if (total > 25 * 1024 * 1024) throw new Error("Anexos acima de 25 MB.");
      const attachments = await Promise.all(files.map(toBase64));
      const body = {
        customer_id: Number(form.customer_id),
        reason: form.reason,
        description: form.description,
        attachments,
        ...(admin ? { seller_id: Number(form.seller_id) } : {}),
      };
      const result = await api<{ message?: string }>("/api/occurrences", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
      setFiles([]);
      setForm({ customer_id: "", seller_id: "", reason: "", description: "" });
      setNotice(result.message || "Ocorrência registrada.");
      if(standalone){router.push("/app/ocorrencias");router.refresh();}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao registrar");
    } finally {
      setBusy(false);
    }
  }
  async function saveStatus() {
    if (editing === null) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ message?: string }>(`/api/admin/occurrences/${editing}`, {
        method: "PATCH",
        body: JSON.stringify({ status, resolution }),
      });
      await load();
      setEditing(null);
      setNotice(result.message || "Status atualizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="min-w-0 space-y-5">
      {!standalone && <><header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div><p className="text-xs font-bold uppercase tracking-widest text-[#0767b4]">Atendimento e suporte</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Ocorrências</h1><p className="text-sm text-slate-500">Consulte e acompanhe os registros comerciais.</p></div><Link href="/app/ocorrencias/nova" className="rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-bold text-white">+ Nova ocorrência</Link></header>
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Registros</p><p className="mt-1 text-2xl font-extrabold">{rows.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Em andamento</p><p className="mt-1 text-2xl font-extrabold text-[#0767b4]">{rows.filter(o=>o.status==="aberta"||o.status==="em_analise").length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Solucionadas</p><p className="mt-1 text-2xl font-extrabold text-emerald-700">{rows.filter(o=>o.status==="solucionada").length}</p></div></div>
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"><input type="search" aria-label="Pesquisar ocorrências" className="min-w-56 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm" placeholder="Pesquisar R.O., cliente, motivo ou CNPJ" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filtrar status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"><option value="all">Todos os status</option>{statuses.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div></>}
      {standalone && <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#0767b4]">Atendimento e suporte</p><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Registrar ocorrência</h1><p className="mt-1 text-sm text-slate-500">Descreva a situação e envie os documentos necessários para análise.</p></div><Link className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold" href="/app/ocorrencias">Voltar às ocorrências</Link></header>}
      {standalone && <>
      <form className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9" onSubmit={create}>
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#0767b4]">01 · Identificação</p>
          <h2 className="text-lg font-bold text-slate-900">Dados da ocorrência</h2>
          <p className="text-sm text-slate-500">Selecione o cliente, o responsável e o motivo do registro.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="occ-customer">Cliente <span className="text-rose-500">*</span></label>
            <div className="relative">
              <input id="occ-customer" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0767b4] focus:ring-2 focus:ring-blue-100"
                role="combobox" aria-autocomplete="list" aria-expanded={customerOpen} aria-controls="occ-customer-options"
                placeholder="Pesquisar empresa, fantasia ou CNPJ" value={customerOpen?customerQuery:(customers.find(c=>String(c.id)===form.customer_id)?.legal_name||customerQuery)}
                onFocus={()=>{setCustomerOpen(true);setCustomerQuery("");}}
                onChange={e=>{setCustomerQuery(e.target.value);setCustomerOpen(true);setForm(v=>({...v,customer_id:""}));}}
                onBlur={()=>window.setTimeout(()=>setCustomerOpen(false),120)}/>
              <span className="pointer-events-none absolute left-4 top-3.5 text-slate-400">⌕</span>
              {customerOpen && <div id="occ-customer-options" role="listbox" className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {customers.filter(c=>Boolean(c.active)&&[c.legal_name,c.trade_name,c.cnpj].join(" ").toLocaleLowerCase("pt-BR").includes(customerQuery.toLocaleLowerCase("pt-BR"))).slice(0,70).map(c=>
                  <button type="button" role="option" aria-selected={String(c.id)===form.customer_id} key={c.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{setForm(v=>({...v,customer_id:String(c.id)}));setCustomerQuery(c.legal_name);setCustomerOpen(false);}}
                    className="block w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none">
                    <span className="block truncate text-sm font-semibold text-slate-800">{c.legal_name}</span>
                    <span className="block text-xs text-slate-500">{[c.trade_name,c.cnpj].filter(Boolean).join(" · ")}</span>
                  </button>)}
                {!customers.some(c=>Boolean(c.active)&&[c.legal_name,c.trade_name,c.cnpj].join(" ").toLocaleLowerCase("pt-BR").includes(customerQuery.toLocaleLowerCase("pt-BR"))) && <p className="p-3 text-sm text-slate-500">Nenhum cliente encontrado.</p>}
              </div>}
            </div>
            {form.customer_id && <p className="text-xs font-medium text-emerald-700">Cliente selecionado</p>}
          </div>
          {admin && <div className="min-w-0 space-y-2">
            <label htmlFor="occ-seller" className="text-sm font-semibold text-slate-700">Representante <span className="text-rose-500">*</span></label>
            <div className="relative">
              <select id="occ-seller" required value={form.seller_id} onChange={e=>setForm(v=>({...v,seller_id:e.target.value}))}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-blue-100">
                <option value="">Selecione um representante</option>{sellers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span aria-hidden="true" className="pointer-events-none absolute right-4 top-4 text-slate-500">⌄</span>
            </div>
          </div>}
        </div>
        <div className="space-y-2">
          <label htmlFor="occ-reason" className="text-sm font-semibold text-slate-700">Motivo da ocorrência <span className="text-rose-500">*</span></label>
          <div className="relative">
            <select id="occ-reason" required value={form.reason} onChange={e=>setForm(v=>({...v,reason:e.target.value}))}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-blue-100">
              <option value="">Selecione o motivo principal</option>{reasons.map(reason=><option key={reason} value={reason}>{reason}</option>)}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-4 text-slate-500">⌄</span>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-5"><p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#0767b4]">02 · Detalhamento</p></div>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Relato da ocorrência
          <textarea className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-blue-100 min-h-48 resize-y leading-relaxed"
            required
            rows={6}
            value={form.description}
            onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
          />
        </label>
        <label className="grid gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-700">
          Anexos (até 25 MB no total)
          <p className="text-xs font-normal text-slate-500">Você pode selecionar imagens, vídeos e documentos para complementar o relato.</p>
          <input className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length>0 && <p className="text-xs text-[#0767b4]">{files.length} arquivo(s) selecionado(s) · {(files.reduce((total,file)=>total+file.size,0)/1048576).toFixed(1)} MB</p>}
        </label>
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><Link href="/app/ocorrencias" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">Cancelar</Link><button type="submit" className="rounded-xl bg-[#0767b4] px-7 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Enviando…" : "Registrar ocorrência"}
        </button></div>
      </form></>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!standalone && <><div className="grid gap-4 lg:grid-cols-2">
        {rows.filter(o=>(statusFilter==="all"||o.status===statusFilter)&&[String(o.id),o.customer_name,o.customer_cnpj,o.reason,o.description].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).map(o=><article key={o.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-bold">R.O. {String(o.id).padStart(4,"0")}</h3><p className="text-xs text-slate-500">{o.created_at?new Date(o.created_at).toLocaleString("pt-BR"):"—"}</p></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{statuses.find(s=>s[0]===o.status)?.[1]||o.status||"Aberta"}</span></div>
          <p className="mt-3 font-semibold">{o.customer_name} {o.customer_cnpj?" · "+o.customer_cnpj:""}</p>
          <p className="mt-2 text-xs font-bold uppercase text-[#0767b4]">{o.reason}</p>
          <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{o.description}</p>
          {o.resolution&&<div className="mt-3 rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">Parecer final</p><p className="whitespace-pre-wrap text-sm">{o.resolution}</p></div>}
          <div className="mt-auto flex flex-wrap gap-2 pt-5"><button type="button" className="secondary" onClick={()=>setSelected(selected===o.id?null:o.id)}>{selected===o.id?"Fechar detalhes":"Anexos e linha do tempo"}</button>{admin&&<button type="button" className="secondary" onClick={()=>{setEditing(o.id);setStatus(o.status||"aberta");setResolution(o.resolution||"");}}>Editar parecer</button>}</div>
          <button type="button" className="secondary mt-3" onClick={()=>void downloadApiFile(`/api/occurrences/${o.id}/pdf`,`ocorrencia-${o.id}.pdf`).catch(e=>setError(e instanceof Error?e.message:"Falha ao gerar PDF"))}>PDF da ocorrência</button>
          {selected===o.id&&<div className="mt-4 space-y-4 border-t pt-4"><div><h4 className="text-sm font-bold">Anexos</h4>{o.attachments?.length?o.attachments.map(a=><button type="button" key={a.id} className="mt-2 block text-left text-sm text-[#0767b4] underline" onClick={()=>void downloadApiFile(`/api/occurrences/${o.id}/attachments/${a.id}`,a.filename).catch(e=>setError(e instanceof Error?e.message:"Falha ao baixar anexo"))}>{a.filename}</button>):<p className="text-sm text-slate-500">Sem anexos disponíveis.</p>}</div><div><h4 className="text-sm font-bold">Linha do tempo</h4>{o.timeline?.map((e,i)=><div key={e.id||i} className="mt-2 border-l-2 border-[#0767b4] pl-3"><p className="text-sm font-semibold">{e.title}</p><p className="text-xs text-slate-500">{e.created_at?new Date(e.created_at).toLocaleString("pt-BR"):""} · {e.created_by_name||"Sistema"}</p><p className="whitespace-pre-wrap text-sm">{e.notes}</p></div>)}</div></div>}
        </article>)}
      </div>
      {editing !== null && admin && (
        <section className="tile">
          <h3>Atualizar ocorrência #{editing}</h3>
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Resolução
            <textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </label>
          <button type="button" className="primary" disabled={busy} onClick={saveStatus}>
            Salvar status
          </button>
          <button type="button" className="secondary" onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </section>
      )}
      </>}
    </section>
  );
}
