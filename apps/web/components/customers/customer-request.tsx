"use client";
import { useState, type FormEvent } from "react";
import { FiCheckCircle, FiLoader, FiSearch } from "react-icons/fi";
import { api } from "@/lib/api";

type Form = {
  cnpj: string; legal_name: string; trade_name: string; contact_person: string;
  phone_1: string; purchase_email: string; state_registration: string; address: string; notes: string;
};
type Lookup = Partial<Form> & { phone?: string; email?: string };
const empty: Form = { cnpj: "", legal_name: "", trade_name: "", contact_person: "", phone_1: "", purchase_email: "", state_registration: "", address: "", notes: "" };
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
  { key: "trade_name", label: "Nome fantasia" },
  { key: "state_registration", label: "Inscrição estadual" },
  { key: "contact_person", label: "Pessoa de contato", required: true },
  { key: "phone_1", label: "Telefone com DDD", required: true, placeholder: "(00) 00000-0000" },
  { key: "purchase_email", label: "E-mail de compras", type: "email", placeholder: "compras@empresa.com.br" },
  { key: "address", label: "Endereço", span: true },
  { key: "notes", label: "Observações", span: true },
];
export default function CustomerRequest() {
  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [verified, setVerified] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function lookup() {
    const cnpj = digits(form.cnpj);
    setError(""); setNotice(""); setVerified("");
    if (!isValidCnpj(cnpj)) { setError("CNPJ inválido. Confira os 14 dígitos."); return; }
    setSearching(true);
    try {
      const result = await api<Lookup>(`/api/integrations/cnpj?cnpj=${cnpj}`);
      setForm(old => digits(old.cnpj) === cnpj ? ({
        ...old, legal_name: result.legal_name || old.legal_name,
        trade_name: result.trade_name || old.trade_name,
        state_registration: result.state_registration || old.state_registration,
        phone_1: result.phone || old.phone_1,
        purchase_email: result.email || old.purchase_email,
        address: result.address || old.address,
      }) : old);
      setVerified(cnpj);
      setNotice("CNPJ consultado. Confira os dados e complete as informações de contato.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível consultar o CNPJ.");
    } finally { setSearching(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!isValidCnpj(form.cnpj)) { setError("Informe um CNPJ válido."); return; }
    if (verified !== digits(form.cnpj)) { setError("Consulte o CNPJ antes de enviar a solicitação."); return; }
    setBusy(true);
    try {
      const result = await api<{ message?: string }>("/api/customer-requests", {
        method: "POST", body: JSON.stringify({ ...form, cnpj: digits(form.cnpj) }),
      });
      setForm(empty); setVerified("");
      setNotice(result.message || "Solicitação enviada para análise.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar solicitação."); }
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
        <div className="rounded-xl border border-[#d5e7f5] bg-[#f6faff] p-4 sm:p-5">
          <label htmlFor="request-cnpj" className="mb-2 block text-sm font-semibold text-[#24374c]">CNPJ <span className="text-rose-600">*</span></label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="request-cnpj" className={fieldClass} inputMode="numeric" maxLength={18} autoComplete="off" placeholder="00.000.000/0000-00" value={form.cnpj}
              onChange={e => { setForm(x => ({ ...x, cnpj: maskCnpj(e.target.value) })); setVerified(""); setError(""); }}
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
              {key === "notes" ? <textarea rows={3} className={fieldClass} value={form[key]} onChange={e => setForm(x => ({ ...x, [key]: e.target.value }))} placeholder="Informações adicionais para a equipe de cadastro" /> :
                <input className={fieldClass} type={type || "text"} required={required} placeholder={placeholder} value={form[key]} onChange={e => setForm(x => ({ ...x, [key]: e.target.value }))} />}
            </label>
          ))}
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
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
