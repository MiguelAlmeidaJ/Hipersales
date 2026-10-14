"use client";
import { useState, type FormEvent } from "react";
import { FiCheckCircle, FiLoader, FiSearch } from "react-icons/fi";
import { api } from "@/lib/api";
import { showPopup } from "@/components/ui/feedback-popup";
import { useAuthenticatedUser } from "@/components/auth/session-context";

type Form = {
  cnpj: string; legal_name: string; trade_name: string; contact_person: string;
  phone_1: string; phone_2: string; purchase_email: string; billing_email: string; xml_email: string;
  state_registration: string; address: string; neighborhood: string; city: string; state: string; zip_code: string;
  scheduled_delivery: string; scheduling_instructions: string; delivery_warnings: string; notes: string;
};
type Lookup = Partial<Form> & { phone?: string; email?: string; address_line?: string };
const DEFAULT_SCHEDULING = "Descarga por ordem de chegada de segunda a sexta";
const empty: Form = { cnpj: "", legal_name: "", trade_name: "", contact_person: "", phone_1: "", phone_2: "", purchase_email: "", billing_email: "", xml_email: "", state_registration: "", address: "", neighborhood: "", city: "", state: "", zip_code: "", scheduled_delivery: "no", scheduling_instructions: DEFAULT_SCHEDULING, delivery_warnings: "", notes: "" };
const digits = (value: string) => value.replace(/\D/g, "");
function maskCnpj(value: string) {
  const v = digits(value).slice(0, 14);
  return v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\/\d{4})(\d)/, "$1-$2");
}
function isValidCnpj(value: string) {
  const v = digits(value);
  if (v.length !== 14 || /^(\d)\1{13}$/.test(v)) return false;
  const check = (length: number) => {
    let weight = length - 7, total = 0;
    for (let i = 0; i < length; i++) {
      total += Number(v[i]) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(v[12]) && check(13) === Number(v[13]);
}
const fieldClass = "w-full min-w-0 rounded-xl border border-[#dce5ed] bg-white px-3.5 py-3 text-sm text-[#111111] outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-[#dcefff] disabled:bg-slate-50";
const fields: { key: keyof Form; label: string; required?: boolean; span?: boolean; type?: string; placeholder?: string }[] = [
  { key: "legal_name", label: "Razão social", required: true, span: true },
  { key: "trade_name", label: "Nome fantasia / fachada estabelecimento", span: true },
  { key: "state_registration", label: "Inscrição estadual" },
  { key: "address", label: "Endereço", span: true },
  { key: "neighborhood", label: "Bairro" }, { key: "city", label: "Cidade" },
  { key: "state", label: "UF" }, { key: "zip_code", label: "CEP" },
  { key: "contact_person", label: "Pessoa de contato", required: true, span: true },
  { key: "phone_1", label: "Telefone 1", required: true, placeholder: "(00) 00000-0000" },
  { key: "phone_2", label: "Telefone 2", placeholder: "(00) 00000-0000" },
  { key: "purchase_email", label: "E-mail compras", required: true, type: "email", span: true },
  { key: "billing_email", label: "E-mail boletos", type: "email", span: true },
  { key: "xml_email", label: "E-mail XML", type: "email", span: true },
];
const states = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
export default function CustomerRequest() {
  const [form, setForm] = useState<Form>(empty);
  const user = useAuthenticatedUser();
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [verified, setVerified] = useState("");
  async function lookup() {
    const cnpj = digits(form.cnpj);
    setVerified("");
    if (!isValidCnpj(cnpj)) { showPopup("error", "CNPJ inválido", "Confira os 14 dígitos informados."); return; }
    setSearching(true);
    try {
      const result = await api<Lookup>(`/api/integrations/cnpj?cnpj=${cnpj}`);
      setForm(old => digits(old.cnpj) === cnpj ? ({
        ...old, legal_name: result.legal_name || old.legal_name,
        trade_name: result.trade_name || old.trade_name,
        state_registration: result.state_registration || old.state_registration,
        phone_1: result.phone || old.phone_1,
        purchase_email: result.email || old.purchase_email,
        address: result.address_line || result.address || old.address,
        neighborhood: result.neighborhood || old.neighborhood,
        city: result.city || old.city,
        state: result.state || old.state,
        zip_code: result.zip_code || old.zip_code,
        phone_2: result.phone_2 || old.phone_2,
      }) : old);
      setVerified(cnpj);
      showPopup("success", "Consulta concluída", "Confira os dados e complete as informações de contato.");
    } catch (e) {
      showPopup("error", "Erro na consulta", e instanceof Error ? e.message : "Não foi possível consultar o CNPJ.");
    } finally { setSearching(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidCnpj(form.cnpj)) { showPopup("error", "CNPJ inválido", "Informe um CNPJ válido."); return; }
    if (verified !== digits(form.cnpj)) { showPopup("error", "Consulta obrigatória", "Consulte o CNPJ antes de enviar."); return; }
    if (form.scheduled_delivery === "yes" && !form.scheduling_instructions.trim()) { showPopup("error", "Agendamento obrigatório", "Informe como agendar a entrega."); return; }
    setBusy(true);
    try {
      const result = await api<{ message?: string }>("/api/customer-requests", {
        method: "POST", body: JSON.stringify({ ...form, cnpj: digits(form.cnpj) }),
      });
      setForm(empty); setVerified("");
      showPopup("success", "Solicitação enviada", result.message || "Sua solicitação foi encaminhada para análise.");
    } catch (e) { showPopup("error", "Erro ao enviar", e instanceof Error ? e.message : "Falha ao enviar solicitação."); }
    finally { setBusy(false); }
  }
  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-[#e4ebf0] bg-white p-5 shadow-sm sm:p-8">
      <header className="mb-7">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0767b4]">Cadastro de clientes</p>
        <h2 className="mt-1 text-2xl font-bold text-[#111111]">Solicitar novo cliente</h2>
        <p className="mt-2 text-sm text-[#657586]">Comece pelo CNPJ. O sistema consulta os dados e verifica se a empresa já está cadastrada ou possui solicitação pendente.</p>
      </header>
      <form className="space-y-6" onSubmit={submit}>
        <div className="rounded-xl border border-[#e4ebf0] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#0767b4]">Solicitante</p><h3 className="mt-1 mb-3 font-semibold">Dados do representante</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Nome do representante<input className={fieldClass} value={user.name || ""} readOnly /></label><label className="text-sm font-medium">E-mail do representante<input className={fieldClass} value={user.communication_email || user.email || ""} readOnly /></label></div></div>
        <div className="rounded-xl border border-[#d5e7f5] bg-[#f6faff] p-4 sm:p-5">
          <label htmlFor="request-cnpj" className="mb-2 block text-sm font-semibold text-[#24374c]">CNPJ <span className="text-rose-600">*</span></label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="request-cnpj" className={fieldClass} inputMode="numeric" maxLength={18} autoComplete="off" placeholder="00.000.000/0000-00" value={form.cnpj}
              onChange={e => { setForm(x => ({ ...x, cnpj: maskCnpj(e.target.value) })); setVerified(""); }}
              onBlur={() => { if (digits(form.cnpj).length === 14 && verified !== digits(form.cnpj) && !searching) void lookup(); }} required />
            <button type="button" onClick={() => void lookup()} disabled={searching || busy}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0767b4] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#073c96] disabled:opacity-60">
              {searching ? <FiLoader className="animate-spin" /> : <FiSearch />}
              {searching ? "Consultando..." : "Consultar CNPJ"}
            </button>
          </div>
          {verified === digits(form.cnpj) && <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700"><FiCheckCircle/> Consulta concluída</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ key, label, required, span, type, placeholder }) => (
            <label key={key} className={`block min-w-0 ${span ? "sm:col-span-2" : ""}`}>
              <span className="mb-2 block text-sm font-semibold text-[#24374c]">{label} {required && <span className="text-rose-600">*</span>}</span>
              {key === "state" ? <select className={fieldClass} value={form.state} onChange={e => setForm(x => ({ ...x, state: e.target.value }))}><option value="">Selecione UF</option>{states.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select> : <input className={fieldClass} type={type || "text"} required={required} placeholder={placeholder} value={form[key]} onChange={e => setForm(x => ({ ...x, [key]: e.target.value }))} />}
            </label>
          ))}
        </div>
        <section className="rounded-xl border border-[#e4ebf0] p-4 sm:p-5 space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-wider text-[#0767b4]">Entrega</p><h3 className="mt-1 font-semibold">Condições de recebimento</h3></div>
          <label className="block text-sm font-semibold text-[#24374c]">Entrega agendada
            <select className={fieldClass} value={form.scheduled_delivery} onChange={e => setForm(x => ({ ...x, scheduled_delivery: e.target.value, scheduling_instructions: e.target.value === "yes" ? "" : DEFAULT_SCHEDULING }))}>
              <option value="no">Não</option><option value="yes">Sim</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-[#24374c]">Como agendar {form.scheduled_delivery === "yes" && <span className="text-rose-600">*</span>}
            <input className={fieldClass} value={form.scheduling_instructions} disabled={form.scheduled_delivery !== "yes"} required={form.scheduled_delivery === "yes"} onChange={e => setForm(x => ({ ...x, scheduling_instructions: e.target.value }))} />
          </label>
          <label className="block text-sm font-semibold text-[#24374c]">Advertências para recebimento
            <textarea className={fieldClass} rows={3} value={form.delivery_warnings} onChange={e => setForm(x => ({ ...x, delivery_warnings: e.target.value }))} />
          </label>
          <label className="block text-sm font-semibold text-[#24374c]">Observações adicionais
            <textarea className={fieldClass} rows={3} value={form.notes} onChange={e => setForm(x => ({ ...x, notes: e.target.value }))} />
          </label>
        </section>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-[#e4ebf0] pt-5 sm:flex-row sm:items-center">
          <p className="text-xs text-[#657586]">A solicitação será analisada antes de vincular o cliente à sua carteira.</p>
          <button type="submit" disabled={busy || searching || verified !== digits(form.cnpj)}
            className="w-full rounded-xl bg-[#0767b4] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#073c96] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {busy ? "Enviando solicitação..." : "Enviar solicitação"}
          </button>
        </div>
      </form>
    </section>
  );
}
