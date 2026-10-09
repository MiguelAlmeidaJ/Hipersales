"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
type Stage = { name: string; color: string };
type Status = { key: string; name: string; color: string };
type Template = { subject: string; body: string };
type Templates = { email: Record<string, Template>; whatsapp: Record<string, Template> };
type Config = {
  customer_funnel?: Stage[];
  product_funnel?: Stage[];
  order_statuses?: Status[];
  message_templates?: Templates;
};
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const sample: Stage = { name: "", color: "#0D6FD8" };
export default function WorkflowSettings() {
  const [data, setData] = useState<Config>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ settings: Config }>("/api/admin/settings")
      .then((r) => {
        if (active) setData(r.settings || {});
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Erro ao carregar configurações");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(section: keyof Config) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api<{ message?: string; settings: Config }>("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ section, data: data[section] }),
      });
      setData(response.settings || {});
      setNotice(`Configuração "${section}" salva.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }
  function stages(section: "customer_funnel" | "product_funnel") {
    const values = data[section] || [];
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5" key={section}>
        <h3 className="mb-3 text-lg font-semibold">
          {section === "customer_funnel" ? "Funil de clientes" : "Funil de produtos"}
        </h3>
        <div className="space-y-3">
          {values.map((v, index) => (
            <div key={index} className="flex flex-wrap items-center gap-3">
              <input
                aria-label="Nome da etapa"
                className={input + " min-w-48 flex-1"}
                value={v.name}
                onChange={(e) =>
                  setData((x) => ({
                    ...x,
                    [section]: values.map((t, i) =>
                      i === index ? { ...t, name: e.target.value } : t,
                    ),
                  }))
                }
              />
              <input
                type="color"
                aria-label="Cor da etapa"
                className="h-11 w-14"
                value={v.color}
                onChange={(e) =>
                  setData((x) => ({
                    ...x,
                    [section]: values.map((t, i) =>
                      i === index ? { ...t, color: e.target.value } : t,
                    ),
                  }))
                }
              />
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-red-700"
                disabled={busy || values.length === 1}
                onClick={() =>
                  setData((x) => ({ ...x, [section]: values.filter((_, i) => i !== index) }))
                }
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2"
            onClick={() => setData((x) => ({ ...x, [section]: [...values, { ...sample }] }))}
          >
            Adicionar etapa
          </button>
          <button
            type="button"
            disabled={busy || !values.some((v) => v.name.trim())}
            className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-50"
            onClick={() => void save(section)}
          >
            Salvar funil
          </button>
        </div>
      </section>
    );
  }
  const statuses = data.order_statuses || [];
  const templates = data.message_templates;
  function updateTemplate(
    channel: "email" | "whatsapp",
    key: string,
    part: "subject" | "body",
    value: string,
  ) {
    setData((current) => {
      const currentTemplates = current.message_templates;
      if (!currentTemplates) return current;
      return {
        ...current,
        message_templates: {
          ...currentTemplates,
          [channel]: {
            ...currentTemplates[channel],
            [key]: { ...currentTemplates[channel][key], [part]: value },
          },
        },
      };
    });
  }
  if (!loaded) return <p role="status">Carregando fluxos e modelos…</p>;
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-bold">Fluxos e modelos de mensagens</h2>
        <p className="text-sm text-slate-500">
          Etapas e modelos são validados pela API antes de serem salvos.
        </p>
      </header>
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-green-50 p-3 text-green-800" role="status">
          {notice}
        </p>
      )}
      {stages("customer_funnel")}
      {stages("product_funnel")}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-lg font-semibold">Cores dos status de pedidos</h3>
        <p className="mb-3 text-sm text-slate-500">
          A API determina nomes e transições válidas. Aqui é possível editar somente as cores.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {statuses.map((item, i) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm"
            >
              {item.name}
              <input
                aria-label={`Cor de ${item.name}`}
                type="color"
                className="h-10 w-14"
                value={item.color}
                onChange={(e) =>
                  setData((x) => ({
                    ...x,
                    order_statuses: statuses.map((v, j) =>
                      j === i ? { ...v, color: e.target.value } : v,
                    ),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-white"
          disabled={busy}
          onClick={() => void save("order_statuses")}
        >
          Salvar cores
        </button>
      </section>
      {templates && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-lg font-semibold">Modelos de mensagens</h3>
          {(["email", "whatsapp"] as const).map((channel) => (
            <div key={channel} className="mb-6 space-y-4">
              <h4 className="font-semibold">{channel === "email" ? "E-mail" : "WhatsApp"}</h4>
              {Object.entries(templates[channel] || {}).map(([key, item]) => (
                <div key={key} className="space-y-2 rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">
                    {key === "customer_approved"
                      ? "Cadastro aprovado"
                      : "Mudança de status do pedido"}
                  </p>
                  <label className="grid gap-1 text-sm">
                    Assunto
                    <input
                      className={input}
                      value={item.subject}
                      onChange={(e) => updateTemplate(channel, key, "subject", e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Mensagem
                    <textarea
                      className={input + " min-h-36 font-mono text-sm"}
                      value={item.body}
                      onChange={(e) => updateTemplate(channel, key, "body", e.target.value)}
                    />
                  </label>
                </div>
              ))}
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Os modelos de e-mail devem preservar a estrutura HTML para que o backend não substitua o
            conteúdo pelo padrão.
          </p>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-white"
            onClick={() => void save("message_templates")}
          >
            Salvar modelos
          </button>
        </section>
      )}
    </div>
  );
}
