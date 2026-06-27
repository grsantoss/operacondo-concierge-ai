import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Icon } from "@/components/brand/Icon";

export const Route = createFileRoute("/app/moradores")({
  head: () => ({ meta: [{ title: "Moradores | Concierge OperaCondo" }] }),
  component: MoradoresPage,
});

type Status = "Residente" | "Locatário" | "Vago" | "Proprietário";

interface Morador {
  nome: string;
  unidade: string;
  bloco: string;
  status: Status;
  vagas: number;
  pets: number;
  contato: string;
  ultimo: string;
}

const STATUS_CLS: Record<Status, string> = {
  Residente: "bg-emerald-50 text-emerald-700",
  Locatário: "bg-blue-50 text-blue-700",
  Vago: "bg-slate-100 text-slate-600",
  Proprietário: "bg-violet-50 text-violet-700",
};

const ROWS: Morador[] = [
  { nome: "Ana Carvalho", unidade: "1204", bloco: "Torre A", status: "Residente", vagas: 2, pets: 1, contato: "+55 11 99988-1204", ultimo: "Hoje, 09:14" },
  { nome: "Marcelo Reis", unidade: "802", bloco: "Torre A", status: "Locatário", vagas: 1, pets: 0, contato: "+55 11 99812-0802", ultimo: "Ontem, 21:02" },
  { nome: "Júlia Tavares", unidade: "506", bloco: "Torre B", status: "Residente", vagas: 1, pets: 2, contato: "+55 11 98123-0506", ultimo: "Há 2d" },
  { nome: "Bruno Lima", unidade: "Cob. 02", bloco: "Torre B", status: "Proprietário", vagas: 3, pets: 0, contato: "+55 11 99777-0002", ultimo: "Há 4d" },
  { nome: "Família Mendes", unidade: "401", bloco: "Torre A", status: "Residente", vagas: 2, pets: 1, contato: "+55 11 98888-0401", ultimo: "Há 1 sem" },
  { nome: "—", unidade: "1101", bloco: "Torre B", status: "Vago", vagas: 0, pets: 0, contato: "—", ultimo: "—" },
  { nome: "Camila Duarte", unidade: "302", bloco: "Torre A", status: "Locatário", vagas: 1, pets: 0, contato: "+55 11 99001-0302", ultimo: "Hoje, 14:22" },
  { nome: "Eduardo Pires", unidade: "907", bloco: "Torre B", status: "Residente", vagas: 2, pets: 1, contato: "+55 11 98444-0907", ultimo: "Há 3d" },
];

function MoradoresPage() {
  return (
    <AppShell
      title="Moradores"
      breadcrumbs={[{ label: "OperaCondo" }, { label: "Moradores" }]}
      actions={
        <>
          <button className="btn-press btn-press-active hidden h-10 items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-white px-4 text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-low)] sm:inline-flex">
            <Icon name="upload" className="text-[18px]" /> Importar CSV
          </button>
          <button className="btn-press btn-press-active inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]">
            <Icon name="person_add" className="text-[18px]" /> Novo morador
          </button>
        </>
      }
    >
      {/* Summary */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Unidades", v: "248", i: "domain" },
          { l: "Ocupação", v: "94%", i: "trending_up" },
          { l: "Pets registrados", v: "62", i: "pets" },
          { l: "WhatsApp ativos", v: "228", i: "chat" },
        ].map((s) => (
          <div key={s.l} className="card-elev rounded-xl p-4">
            <div className="flex items-center gap-2 text-[var(--color-on-surface-variant)]">
              <Icon name={s.i} className="text-[18px]" />
              <p className="text-xs font-semibold uppercase tracking-wider">{s.l}</p>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-[var(--color-navy)]">{s.v}</p>
          </div>
        ))}
      </section>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-outline-variant)] bg-white p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--color-on-surface-variant)]"
          />
          <input
            placeholder="Buscar por nome, unidade, telefone…"
            className="w-full rounded-lg border border-[var(--color-outline-variant)] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15"
          />
        </div>
        {["Todos", "Residente", "Locatário", "Proprietário", "Vago"].map((c, i) => (
          <button
            key={c}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              i === 0
                ? "bg-[var(--color-navy)] text-white"
                : "bg-[var(--color-surface-mid)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-high)]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-elev overflow-hidden rounded-2xl">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[var(--color-surface-low)] text-[var(--color-on-surface-variant)]">
              <tr className="text-[11px] uppercase tracking-wider">
                <th className="px-5 py-3 font-semibold">Morador</th>
                <th className="px-5 py-3 font-semibold">Unidade</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Vagas</th>
                <th className="px-5 py-3 font-semibold">Pets</th>
                <th className="px-5 py-3 font-semibold">Última interação</th>
                <th className="px-5 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-outline-variant)]">
              {ROWS.map((m) => (
                <tr key={m.unidade} className="bg-white hover:bg-[var(--color-surface-low)]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[var(--color-navy)] to-[var(--color-brand)] text-xs font-bold text-white">
                        {m.nome === "—"
                          ? "—"
                          : m.nome
                              .split(" ")
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join("")}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--color-navy)]">{m.nome}</p>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">{m.contato}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-sm font-semibold text-[var(--color-navy)]">{m.unidade}</p>
                    <p className="text-xs text-[var(--color-on-surface-variant)]">{m.bloco}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[var(--color-on-surface-variant)]">{m.vagas}</td>
                  <td className="px-5 py-3.5 text-[var(--color-on-surface-variant)]">{m.pets}</td>
                  <td className="px-5 py-3.5 text-xs text-[var(--color-on-surface-variant)]">{m.ultimo}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        title="WhatsApp"
                        className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        <Icon name="chat" className="text-[18px]" />
                      </button>
                      <button
                        title="Detalhes"
                        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                      >
                        <Icon name="visibility" className="text-[18px]" />
                      </button>
                      <button
                        title="Mais"
                        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-mid)]"
                      >
                        <Icon name="more_horiz" className="text-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-5 py-3 text-xs text-[var(--color-on-surface-variant)]">
          <p>Mostrando 1–8 de 248 moradores</p>
          <div className="flex items-center gap-1">
            <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-white">
              <Icon name="chevron_left" className="text-[18px]" />
            </button>
            {[1, 2, 3, 4, "…", 31].map((p, i) => (
              <button
                key={i}
                className={`min-w-8 rounded-md px-2 py-1 font-semibold ${
                  p === 1 ? "bg-[var(--color-navy)] text-white" : "hover:bg-white"
                }`}
              >
                {p}
              </button>
            ))}
            <button className="grid h-8 w-8 place-items-center rounded-md hover:bg-white">
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
