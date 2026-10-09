export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Conexão indisponível</h1>
        <p className="mt-3 text-slate-600">
          O Hipersales precisa de uma conexão para consultar pedidos, autenticar usuários e salvar
          alterações com segurança.
        </p>
        <a
          href="/"
          className="mt-5 inline-block rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
        >
          Tentar novamente
        </a>
      </section>
    </main>
  );
}
