"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
export default function PasswordChange({
  required = false,
  embedded = false,
  onSuccess,
}: {
  required?: boolean;
  embedded?: boolean;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(required || embedded),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [again, setAgain] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (next.length < 12) {
      setError("A senha deve ter ao menos 12 caracteres.");
      return;
    }
    if (next !== again) {
      setError("As novas senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/me/password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setCurrent("");
      setNext("");
      setAgain("");
      setNotice("Senha atualizada.");
      onSuccess();
      if (!required) setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a senha");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={embedded ? "w-full" : "rounded-xl border border-slate-200 bg-white p-4"}>
      {!required && !embedded && (
        <button
          type="button"
          className="text-sm font-semibold text-blue-700"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Fechar alteração de senha" : "Alterar minha senha"}
        </button>
      )}
      {open && (
        <form onSubmit={submit} className={embedded ? "grid gap-4" : "mt-3 grid max-w-md gap-3"}>
          <h2 className={embedded ? "sr-only" : "text-lg font-semibold"}>
            {required ? "Atualização obrigatória de senha" : "Alterar senha"}
          </h2>
          {!required && (
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Senha atual
              <input
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal outline-none transition focus:border-[#0767b4] focus:ring-2 focus:ring-blue-100"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
          )}
          <label className="grid gap-1 text-sm">
            Nova senha
            <input
              className="rounded-lg border p-2"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Repita a nova senha
            <input
              className="rounded-lg border p-2"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </label>
          <p className="text-xs font-normal text-slate-500">Use pelo menos 12 caracteres.</p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-green-700">
              {notice}
            </p>
          )}
          <button
            disabled={busy}
            className="mt-1 h-11 w-full rounded-xl bg-[#0767b4] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#073c96] disabled:opacity-50"
          >
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}
    </section>
  );
}
