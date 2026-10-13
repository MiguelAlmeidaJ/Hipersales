"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { FiEdit2, FiPlus, FiSearch, FiX } from "react-icons/fi";
import SellerAssignments from "./seller-assignments";
type User = {
  id: number;
  name: string;
  email: string;
  communication_email?: string;
  whatsapp_phone?: string;
  role: "admin" | "seller";
  active: boolean | number;
  is_super_admin?: boolean | number;
};
const initial = {
  name: "",
  email: "",
  communication_email: "",
  whatsapp_phone: "",
  role: "seller",
  active: true,
  temporary_password: "",
};
export default function UsersEditor() {
  const [items, setItems] = useState<User[]>([]);
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [assignmentSeller, setAssignmentSeller] = useState<User | null>(null);
  async function refresh() {
    const r = await api<{ users: User[] }>("/api/admin/users");
    setItems(r.users || []);
  }
  useEffect(() => {
    let alive = true;
    api<{ users: User[] }>("/api/admin/users")
      .then((r) => {
        if (alive) setItems(r.users || []);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const path = (
        editing === null ? "/api/admin/users" : `/api/admin/users/${editing}`
      ) as `/api/${string}`;
      const r = await api<{ message: string }>(path, {
        method: editing === null ? "POST" : "PATCH",
        body: JSON.stringify(form),
      });
      await refresh();
      setEditing(null);
      setForm(initial);
      setModalOpen(false);
      setNotice(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }
  function edit(u: User) {
    setError("");
    setModalOpen(true);
    setEditing(u.id);
    setForm({
      name: u.name,
      email: u.email,
      communication_email: u.communication_email || "",
      whatsapp_phone: u.whatsapp_phone || "",
      role: u.role,
      active: Boolean(u.active),
      temporary_password: "",
    });
  }
  const filtered = items.filter(u => {
    const match = [u.name, u.email, u.communication_email, u.whatsapp_phone].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return match && (filter === "all" || (filter === "active" ? Boolean(u.active) : !Boolean(u.active)));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm({ ...initial });
    setError("");
  }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-extrabold text-[#111111]">Gestão de usuários</h2><p className="mt-1 text-sm text-slate-500">Gerencie acessos, perfis e carteiras comerciais.</p></div>
        <button type="button" onClick={() => { setEditing(null); setForm({ ...initial }); setError(""); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[#0767b4] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#073c96]"><FiPlus size={17}/> Novo usuário</button>
      </div>
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <div className="rounded-2xl border border-[#e4ebf0] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_110px]">
          <label className="relative"><span className="sr-only">Buscar usuário</span><FiSearch size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => {setQuery(e.target.value);setPage(1);}} placeholder="Buscar por nome, login, e-mail ou WhatsApp" className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm"/></label>
          <label><span className="sr-only">Situação</span><select value={filter} onChange={e => {setFilter(e.target.value);setPage(1);}} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm"><option value="all">Todos os usuários</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label>
          <label><span className="sr-only">Por página</span><select value={pageSize} onChange={e => {setPageSize(Number(e.target.value));setPage(1);}} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm">{[10,15,25,50].map(n => <option key={n} value={n}>{n} por pág.</option>)}</select></label>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[#f5f9fc] text-xs text-slate-600"><tr><th className="p-3">Nome</th><th className="p-3">Login</th><th className="p-3">Perfil</th><th className="p-3">Situação</th><th className="p-3">Ações</th></tr></thead>
            <tbody>
              {visible.map(u => <tr key={u.id} className="border-t border-slate-100 hover:bg-[#f8fbfe]">
                <td className="p-3 font-semibold text-slate-900">{u.name}</td><td className="p-3 text-slate-600">{u.email}</td>
                <td className="p-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{u.role === "admin" ? "Administrador" : "Representante"}</span></td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${u.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{u.active ? "Ativo" : "Inativo"}</span></td>
                <td className="p-3"><div className="flex items-center gap-3">{!u.is_super_admin && <><button type="button" onClick={() => edit(u)} className="inline-flex items-center gap-1 text-[#0767b4] hover:underline"><FiEdit2 size={13}/>Editar</button>{u.role === "seller" && <button type="button" onClick={() => setAssignmentSeller(u)} className="text-[#0767b4] hover:underline">Carteira</button>}</>}</div></td>
              </tr>)}
              {!visible.length && <tr><td colSpan={5} className="p-10 text-center text-sm text-slate-500">Nenhum usuário encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{filtered.length} usuário(s) · Página {currentPage} de {pages}</span><div className="flex gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage+1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div>
      </div>
      {modalOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" onMouseDown={e => {if(e.target === e.currentTarget) closeModal();}}>
      <form role="dialog" aria-modal="true" aria-label={editing === null ? "Novo usuário" : "Editar usuário"} onSubmit={submit} className="max-h-[min(92dvh,780px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-semibold">
          {editing === null ? "Novo usuário" : "Editar usuário"}
        </h2><p className="mt-1 text-sm text-slate-500">Preencha os dados e defina as permissões.</p></div><button type="button" aria-label="Fechar" onClick={closeModal} className="rounded-lg p-2 hover:bg-slate-100"><FiX/></button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              "name",
              "email",
              "communication_email",
              "whatsapp_phone",
              "temporary_password",
            ] as const
          ).map((k) => (
            <label className="grid gap-1 text-sm" key={k}>
              {
                (
                  {
                    name: "Nome",
                    email: "Login",
                    communication_email: "E-mail",
                    whatsapp_phone: "WhatsApp",
                    temporary_password: "Senha temporária",
                  } as const
                )[k]
              }
              <input
                type={k === "temporary_password" ? "password" : "text"}
                required={
                  k === "name" || k === "email" || (k === "temporary_password" && editing === null)
                }
                minLength={k === "temporary_password" ? 12 : undefined}
                className="min-w-0 rounded-lg border border-slate-300 p-2.5"
                value={form[k]}
                onChange={(e) => setForm((v) => ({ ...v, [k]: e.target.value }))}
              />
            </label>
          ))}
          <label className="grid gap-1 text-sm">
            Perfil
            <select
              className="rounded-lg border p-2.5"
              value={form.role}
              onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))}
            >
              <option value="seller">Representante</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))}
            />{" "}
            Ativo
          </label>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} className="rounded-lg border px-4 py-2 text-sm" onClick={closeModal}>Cancelar</button><button disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white">
          Salvar usuário
        </button>
</div>
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
      </form></div>}
      {/* User directory and filters are rendered above the dialog. */}
      {assignmentSeller && (
        <div className="mt-5">
          <button
            type="button"
            className="mb-3 rounded-lg border px-3 py-2"
            onClick={() => setAssignmentSeller(null)}
          >
            Fechar carteira
          </button>
          <SellerAssignments
            key={assignmentSeller.id}
            sellerId={assignmentSeller.id}
            sellerName={assignmentSeller.name}
          />
        </div>
      )}
    </section>
  );
}
