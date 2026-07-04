import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/fornecedores/")({
  head: () => ({ meta: [{ title: "Fornecedores | Concierge OperaCondo" }] }),
  component: FornecedoresPage,
});

type Estado = "Homologado" | "Em análise" | "Renovação" | "Inativo";

interface Supplier {
  nome: string;
  categoria: string;
  estado: Estado;
  rating: number;
  ultimos: number;
  cnpj: string;
  contato: string;
}

const ESTADO: Record<Estado, string> = {
  Homologado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Em análise": "bg-amber-50 text-amber-700 border-amber-200",
  Renovação: "bg-blue-50 text-blue-700 border-blue-200",
  Inativo: "bg-slate-100 text-slate-600 border-slate-200",
};

const SUPPLIERS: Supplier[] = [
  { nome: "ElétricaPro Engenharia", categoria: "Elétrica & Iluminação", estado: "Homologado", rating: 4.9, ultimos: 18, cnpj: "12.345.678/0001-90", contato: "+55 11 99888-1010" },
  { nome: "AquaService Piscinas", categoria: "Piscina & Lazer", estado: "Homologado", rating: 4.7, ultimos: 9, cnpj: "22.987.654/0001-12", contato: "+55 11 98777-2020" },
  { nome: "Guarda24 Segurança", categoria: "Segurança Patrimonial", estado: "Renovação", rating: 4.6, ultimos: 24, cnpj: "33.111.222/0001-33", contato: "+55 11 97666-3030" },
  { nome: "LimpaTudo Predial", categoria: "Limpeza & Conservação", estado: "Em análise", rating: 4.3, ultimos: 3, cnpj: "44.222.333/0001-44", contato: "+55 11 96555-4040" },
  { nome: "ClimaCerto HVAC", categoria: "Ar-condicionado", estado: "Homologado", rating: 4.8, ultimos: 12, cnpj: "55.333.444/0001-55", contato: "+55 11 95444-5050" },
  { nome: "Jardim Vivo Paisagismo", categoria: "Jardinagem", estado: "Em análise", rating: 4.1, ultimos: 2, cnpj: "66.444.555/0001-66", contato: "+55 11 94333-6060" },
  { nome: "Elevatec Modernização", categoria: "Elevadores", estado: "Homologado", rating: 4.9, ultimos: 7, cnpj: "77.555.666/0001-77", contato: "+55 11 93222-7070" },
  { nome: "DedetiSul Controle", categoria: "Dedetização", estado: "Inativo", rating: 3.8, ultimos: 0, cnpj: "88.666.777/0001-88", contato: "+55 11 92111-8080" },
];

function FornecedoresPage() {
  return (
    <AppShell
      title="Fornecedores"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Fornecedores" }]}
      actions={
        <>
          <button className="btn-press btn-press-active hidden h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] sm:inline-flex">
            <Icon name="fact_check" className="text-[18px]" /> Homologações
          </button>
          <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]">
            <Icon name="add_business" className="text-[18px]" /> Cadastrar fornecedor
          </button>
        </>
      }
    >
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Homologados", v: "42", i: "verified", t: "text-emerald-700 bg-emerald-50" },
          { l: "Em análise", v: "5", i: "pending", t: "text-amber-700 bg-amber-50" },
          { l: "Renovação", v: "3", i: "autorenew", t: "text-blue-700 bg-blue-50" },
          { l: "Categorias", v: "14", i: "category", t: "text-violet-700 bg-violet-50" },
        ].map((s) => (
          <div key={s.l} className="card-elev rounded-xl p-4">
            <div className={`inline-grid h-9 w-9 place-items-center rounded-lg ${s.t}`}>
              <Icon name={s.i} className="text-[18px]" />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-on-surface-variant)]">
              {s.l}
            </p>
            <p className="text-2xl font-bold text-[var(--color-navy)]">{s.v}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SUPPLIERS.map((s) => (
          <article
            key={s.cnpj}
            className="card-elev group rounded-2xl p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-navy)] text-white">
                  <Icon name="storefront" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[var(--color-navy)]">
                    {s.nome}
                  </h3>
                  <p className="truncate text-xs text-[var(--color-on-surface-variant)]">
                    {s.categoria}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ESTADO[s.estado]}`}>
                {s.estado}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--color-surface-low)] p-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">Rating</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold text-[var(--color-navy)]">
                  <Icon name="star" className="text-[14px] text-amber-500" filled />
                  {s.rating.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">Serviços</p>
                <p className="mt-0.5 text-sm font-bold text-[var(--color-navy)]">{s.ultimos}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-on-surface-variant)]">CNPJ</p>
                <p className="mt-0.5 truncate font-mono text-[10px] font-semibold text-[var(--color-navy)]">
                  {s.cnpj.slice(0, 10)}…
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button className="btn-press btn-press-active flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700">
                <Icon name="chat" className="text-[16px]" /> WhatsApp
              </button>
              <button className="btn-press btn-press-active grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-low)]">
                <Icon name="description" className="text-[18px]" />
              </button>
              <button className="btn-press btn-press-active grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-low)]">
                <Icon name="more_horiz" className="text-[18px]" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
