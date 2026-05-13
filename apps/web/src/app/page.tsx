import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Real-Time Sales Coaching</h1>
      <p className="mt-4 text-slate-400">
        Copiloto silencioso para vendedores B2B consultivos. Detecta etapa,
        objeciones y campos faltantes en tiempo real.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/session/demo"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-teal-300"
        >
          Abrir sesion demo
        </Link>
      </div>
      <p className="mt-10 text-xs text-slate-500">
        Asegurate de levantar la API (`pnpm --filter @rtsc/api dev`) y configurar
        GOOGLE_API_KEY si quieres analisis con Gemini. Sin la key el motor cae a
        reglas heuristicas.
      </p>
    </main>
  );
}
