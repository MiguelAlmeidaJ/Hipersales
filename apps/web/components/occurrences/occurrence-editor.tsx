"use client";
import { useEffect, useState, type FormEvent } from "react";
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
export default function OccurrenceEditor({ user }: { user: SessionUser }) {
  const admin = user.role === "admin" || user.role === "dev";
  const [rows, setRows] = useState<Occurrence[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [form, setForm] = useState({ customer_id: "", seller_id: "", reason: "", description: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
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
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#0767b4]">Atendimento e suporte</p><p className="text-sm text-slate-500">Registre, acompanhe e resolva solicitações comerciais.</p></div><span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">{rows.length} registros</span></div>
      <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-3" onSubmit={create}>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">
          Cliente — busque por razão social, fantasia ou CNPJ
          <input value={customerQuery} onChange={e=>setCustomerQuery(e.target.value)} placeholder="Buscar cliente..." />
          <select required value={form.customer_id} onChange={e=>setForm(v=>({...v,customer_id:e.target.value}))}>
            <option value="">Selecione o cliente</option>
            {customers.filter(c=>Boolean(c.active)&&(String(c.legal_name||"")+" "+String(c.trade_name||"")+" "+String(c.cnpj||"")).toLocaleLowerCase("pt-BR").includes(customerQuery.toLocaleLowerCase("pt-BR"))).map(c=><option key={c.id} value={c.id}>{c.legal_name} {c.cnpj?" · "+c.cnpj:""}</option>)}
          </select>
        </label>
        {admin && (
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">
            Representante
            <select
              required
              value={form.seller_id}
              onChange={(e) => setForm((v) => ({ ...v, seller_id: e.target.value }))}
            >
              <option value="">Selecione</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">
          Motivo da ocorrência
          <select required value={form.reason} onChange={e=>setForm(v=>({...v,reason:e.target.value}))}><option value="">Selecione o motivo</option>{reasons.map(r=><option key={r} value={r}>{r}</option>)}</select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600 sm:col-span-2 xl:col-span-3">
          Relato da ocorrência
          <textarea
            required
            rows={6}
            value={form.description}
            onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
          />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">
          Anexos (até 25 MB no total)
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </label>
        <button type="submit" className="rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Enviando…" : "Registrar ocorrência"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map(o=><article key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-bold">R.O. {String(o.id).padStart(4,"0")}</h3><p className="text-xs text-slate-500">{o.created_at?new Date(o.created_at).toLocaleString("pt-BR"):"—"}</p></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{statuses.find(s=>s[0]===o.status)?.[1]||o.status||"Aberta"}</span></div>
          <p className="mt-3 font-semibold">{o.customer_name} {o.customer_cnpj?" · "+o.customer_cnpj:""}</p>
          <p className="mt-2 text-xs font-bold uppercase text-[#0767b4]">{o.reason}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{o.description}</p>
          {o.resolution&&<div className="mt-3 rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">Parecer final</p><p className="whitespace-pre-wrap text-sm">{o.resolution}</p></div>}
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="secondary" onClick={()=>setSelected(selected===o.id?null:o.id)}>{selected===o.id?"Fechar detalhes":"Anexos e linha do tempo"}</button>{admin&&<button type="button" className="secondary" onClick={()=>{setEditing(o.id);setStatus(o.status||"aberta");setResolution(o.resolution||"");}}>Editar parecer</button>}</div>
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
    </section>
  );
}
