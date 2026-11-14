import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  atualizarMorador,
  criarMoradores,
  desativarMorador,
  excluirMoradores,
  listarCondominios,
  listarMoradores,
  reativarMorador,
} from "@/lib/moradores.functions";

export type Status = "Residente" | "Locatário" | "Vago" | "Proprietário" | "Inativo";
export type CondoTipo = "vertical" | "horizontal";

export interface Condominio {
  id: string;
  nome: string;
  tipo: CondoTipo;
  cidade: string;
  unidades: number;
}

export interface EnderecoVertical {
  tipo: "vertical";
  bloco: string;
  andar: number;
  apto: string;
}

export interface EnderecoHorizontal {
  tipo: "horizontal";
  quadra: string;
  casa: string;
}

export type Endereco = EnderecoVertical | EnderecoHorizontal;

export interface Morador {
  id: string;
  nome: string;
  condominioId: string;
  endereco: Endereco;
  status: Status;
  vagas: number;
  pets: number;
  contato: string;
  email?: string;
  desde?: string;
  cpf?: string;
  ultimo: string;
  desativadoEm?: string;
}

export const STATUS_CLS: Record<Status, string> = {
  Residente: "bg-success/10 text-success-strong border-success/30",
  Locatário: "bg-primary/10 text-primary border-primary/30",
  Vago: "bg-muted text-muted-foreground border-border",
  Proprietário: "bg-chart-4/10 text-chart-4 border-chart-4/30",
  Inativo: "bg-muted text-muted-foreground border-border",
};

export const STATUS_LIST: Status[] = ["Residente", "Locatário", "Proprietário", "Vago"];

/* -------- Dados do banco (React Query) -------- */

export const condominiosQuery = queryOptions({
  queryKey: ["condominios"],
  queryFn: () => listarCondominios(),
});

export const moradoresQuery = queryOptions({
  queryKey: ["moradores"],
  queryFn: () => listarMoradores(),
});

export function useCondominios(): Condominio[] {
  return useQuery(condominiosQuery).data ?? [];
}

export function useMoradores(opts?: { includeInactive?: boolean }): Morador[] {
  const all = useQuery(moradoresQuery).data ?? [];
  if (opts?.includeInactive) return all;
  return all.filter((m) => m.status !== "Inativo");
}

type NovoMorador = Omit<Morador, "id" | "ultimo">;

function paraEntrada(m: NovoMorador) {
  return {
    nome: m.nome === "—" ? "Unidade vaga" : m.nome,
    condominioId: m.condominioId,
    endereco: m.endereco,
    status: m.status === "Inativo" ? ("Residente" as const) : m.status,
    contato: m.contato,
    email: m.email,
    cpf: m.cpf,
    vagas: m.vagas,
    pets: m.pets,
    desde: m.desde,
  };
}

/** Gravações. Cada uma vai ao banco e recarrega a lista. Erros chegam como Error com mensagem pronta. */
export function useMoradoresAcoes() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: moradoresQuery.queryKey });
  return {
    async addMoradores(items: NovoMorador[]) {
      await criarMoradores({ data: items.map(paraEntrada) });
      await recarregar();
    },
    async updateMorador(id: string, patch: Partial<Omit<Morador, "id">>) {
      const atual = qc.getQueryData(moradoresQuery.queryKey)?.find((m) => m.id === id);
      if (!atual) throw new Error("Morador não encontrado.");
      await atualizarMorador({ data: { id, dados: paraEntrada({ ...atual, ...patch }) } });
      await recarregar();
    },
    async deactivateMorador(id: string) {
      await desativarMorador({ data: { id } });
      await recarregar();
    },
    async reactivateMorador(id: string, novoStatus: "Residente" | "Locatário" | "Proprietário" = "Residente") {
      await reativarMorador({ data: { id, status: novoStatus } });
      await recarregar();
    },
    async deleteMorador(id: string) {
      await excluirMoradores({ data: { ids: [id] } });
      await recarregar();
    },
    async deleteAllInactive() {
      await excluirMoradores({ data: {} });
      await recarregar();
    },
  };
}

/* -------- Helpers -------- */

export function formatEndereco(e: Endereco) {
  if (e.tipo === "vertical") {
    return { primary: `Apto ${e.apto}`, secondary: `${e.bloco} • ${e.andar}º andar`, full: `${e.bloco} • ${e.andar}º andar • Apto ${e.apto}` };
  }
  return { primary: `Casa ${e.casa}`, secondary: `Quadra ${e.quadra}`, full: `Quadra ${e.quadra} • Casa ${e.casa}` };
}

export function initials(nome: string) {
  if (nome === "—") return "—";
  return nome.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

export function whatsappUrl(phone: string, msg?: string) {
  const digits = phone.replace(/\D/g, "");
  const q = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${digits}${q}`;
}

/* -------- CSV import -------- */

export const CSV_HEADERS = [
  "nome",
  "condominio",
  "tipo_endereco",
  "bloco",
  "andar",
  "apto",
  "quadra",
  "casa",
  "status",
  "contato",
  "email",
  "cpf",
  "vagas",
  "pets",
  "desde",
] as const;

export type CsvRow = Partial<Record<(typeof CSV_HEADERS)[number], string>>;

export function csvTemplate(): string {
  const lines = [
    CSV_HEADERS.join(","),
    `Ana Silva,Edifício Aurora,vertical,Torre A,10,1002,,,Residente,+55 11 99999-0000,ana@exemplo.com,,1,0,Jan 2024`,
    `Família Souza,Residencial Parque Verde,horizontal,,,,Q2,08,Proprietário,+55 19 98888-0000,souza@exemplo.com,,2,1,Mar 2023`,
  ];
  return lines.join("\n");
}

export function downloadCsvTemplate() {
  const blob = new Blob([csvTemplate()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-moradores.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface CsvValidationResult {
  valid: Omit<Morador, "id">[];
  errors: { row: number; message: string; raw: CsvRow }[];
}

function findCondoId(condominios: Condominio[], nomeOuId: string): string | null {
  const n = nomeOuId.trim().toLowerCase();
  if (!n) return null;
  const found = condominios.find(
    (c) => c.id === n || c.nome.toLowerCase() === n,
  );
  return found?.id ?? null;
}

export function validateCsvRows(rows: CsvRow[], condominios: Condominio[]): CsvValidationResult {
  const valid: CsvValidationResult["valid"] = [];
  const errors: CsvValidationResult["errors"] = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2; // header is row 1
    const nome = (raw.nome ?? "").trim();
    const condoInput = (raw.condominio ?? "").trim();
    const tipo = (raw.tipo_endereco ?? "").trim().toLowerCase();
    const status = (raw.status ?? "").trim() as Status;
    const contato = (raw.contato ?? "").trim();

    if (!nome) return errors.push({ row: rowNum, message: "Nome é obrigatório", raw });
    const condominioId = findCondoId(condominios, condoInput);
    if (!condominioId)
      return errors.push({ row: rowNum, message: `Condomínio "${condoInput}" não encontrado`, raw });
    if (tipo !== "vertical" && tipo !== "horizontal")
      return errors.push({ row: rowNum, message: "tipo_endereco deve ser 'vertical' ou 'horizontal'", raw });
    if (!STATUS_LIST.includes(status))
      return errors.push({ row: rowNum, message: `status inválido: "${status}"`, raw });
    if (status !== "Vago" && !contato)
      return errors.push({ row: rowNum, message: "contato é obrigatório", raw });

    let endereco: Endereco;
    if (tipo === "vertical") {
      const bloco = (raw.bloco ?? "").trim();
      const andarStr = (raw.andar ?? "").trim();
      const apto = (raw.apto ?? "").trim();
      if (!bloco || !andarStr || !apto)
        return errors.push({ row: rowNum, message: "bloco, andar e apto são obrigatórios para vertical", raw });
      const andar = Number(andarStr);
      if (Number.isNaN(andar))
        return errors.push({ row: rowNum, message: "andar deve ser um número", raw });
      endereco = { tipo: "vertical", bloco, andar, apto };
    } else {
      const quadra = (raw.quadra ?? "").trim();
      const casa = (raw.casa ?? "").trim();
      if (!quadra || !casa)
        return errors.push({ row: rowNum, message: "quadra e casa são obrigatórios para horizontal", raw });
      endereco = { tipo: "horizontal", quadra, casa };
    }

    valid.push({
      nome,
      condominioId,
      endereco,
      status,
      contato: contato || "—",
      email: (raw.email ?? "").trim() || undefined,
      cpf: (raw.cpf ?? "").trim() || undefined,
      vagas: Number(raw.vagas ?? 0) || 0,
      pets: Number(raw.pets ?? 0) || 0,
      desde: (raw.desde ?? "").trim() || undefined,
      ultimo: "Recém-importado",
    });
  });

  return { valid, errors };
}
