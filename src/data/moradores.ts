export type Status = "Residente" | "Locatário" | "Vago" | "Proprietário";
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
}

export const STATUS_CLS: Record<Status, string> = {
  Residente: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Locatário: "bg-blue-50 text-blue-700 border-blue-200",
  Vago: "bg-slate-100 text-slate-600 border-slate-200",
  Proprietário: "bg-violet-50 text-violet-700 border-violet-200",
};

export const CONDOMINIOS: Condominio[] = [
  { id: "aurora", nome: "Edifício Aurora", tipo: "vertical", cidade: "São Paulo — SP", unidades: 248 },
  { id: "parqueverde", nome: "Residencial Parque Verde", tipo: "horizontal", cidade: "Campinas — SP", unidades: 96 },
  { id: "montebello", nome: "Edifício Monte Bello", tipo: "vertical", cidade: "São Paulo — SP", unidades: 132 },
];

export const MORADORES: Morador[] = [
  { id: "m1", nome: "Ana Carvalho", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre A", andar: 12, apto: "1204" }, status: "Residente", vagas: 2, pets: 1, contato: "+55 11 99988-1204", email: "ana.carvalho@exemplo.com", desde: "Mar 2019", cpf: "123.***.***-04", ultimo: "Hoje, 09:14" },
  { id: "m2", nome: "Marcelo Reis", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre A", andar: 8, apto: "802" }, status: "Locatário", vagas: 1, pets: 0, contato: "+55 11 99812-0802", email: "marcelo.reis@exemplo.com", desde: "Ago 2023", cpf: "234.***.***-02", ultimo: "Ontem, 21:02" },
  { id: "m3", nome: "Júlia Tavares", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre B", andar: 5, apto: "506" }, status: "Residente", vagas: 1, pets: 2, contato: "+55 11 98123-0506", email: "julia.t@exemplo.com", desde: "Jan 2021", cpf: "345.***.***-06", ultimo: "Há 2d" },
  { id: "m4", nome: "Bruno Lima", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre B", andar: 22, apto: "Cob. 02" }, status: "Proprietário", vagas: 3, pets: 0, contato: "+55 11 99777-0002", email: "bruno.lima@exemplo.com", desde: "Fev 2017", cpf: "456.***.***-02", ultimo: "Há 4d" },
  { id: "m5", nome: "Família Mendes", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre A", andar: 4, apto: "401" }, status: "Residente", vagas: 2, pets: 1, contato: "+55 11 98888-0401", email: "mendes@exemplo.com", desde: "Nov 2020", ultimo: "Há 1 sem" },
  { id: "m6", nome: "—", condominioId: "aurora", endereco: { tipo: "vertical", bloco: "Torre B", andar: 11, apto: "1101" }, status: "Vago", vagas: 0, pets: 0, contato: "—", ultimo: "—" },
  { id: "m7", nome: "Camila Duarte", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q3", casa: "12" }, status: "Residente", vagas: 2, pets: 1, contato: "+55 19 99001-0303", email: "camila.d@exemplo.com", desde: "Mai 2022", cpf: "567.***.***-12", ultimo: "Hoje, 14:22" },
  { id: "m8", nome: "Eduardo Pires", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q1", casa: "05" }, status: "Locatário", vagas: 1, pets: 0, contato: "+55 19 98444-0907", email: "edu.pires@exemplo.com", desde: "Jul 2024", cpf: "678.***.***-05", ultimo: "Há 3d" },
  { id: "m9", nome: "Renata Sales", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q5", casa: "27" }, status: "Proprietário", vagas: 2, pets: 2, contato: "+55 19 97555-2727", email: "renata.sales@exemplo.com", desde: "Set 2018", cpf: "789.***.***-27", ultimo: "Ontem, 08:40" },
  { id: "m10", nome: "Família Oliveira", condominioId: "parqueverde", endereco: { tipo: "horizontal", quadra: "Q2", casa: "18" }, status: "Residente", vagas: 3, pets: 1, contato: "+55 19 96222-1818", email: "oliveira@exemplo.com", desde: "Fev 2020", ultimo: "Há 6d" },
  { id: "m11", nome: "Sandra Ribeiro", condominioId: "montebello", endereco: { tipo: "vertical", bloco: "Bloco 1", andar: 3, apto: "302" }, status: "Residente", vagas: 1, pets: 0, contato: "+55 11 95111-0302", email: "sandra.r@exemplo.com", desde: "Out 2021", cpf: "890.***.***-02", ultimo: "Hoje, 07:55" },
  { id: "m12", nome: "Pedro Nakamura", condominioId: "montebello", endereco: { tipo: "vertical", bloco: "Bloco 2", andar: 9, apto: "908" }, status: "Locatário", vagas: 1, pets: 1, contato: "+55 11 94222-0908", email: "pedro.n@exemplo.com", desde: "Abr 2024", cpf: "901.***.***-08", ultimo: "Há 2 sem" },
];

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

export function getMorador(id: string) {
  return MORADORES.find((m) => m.id === id);
}

export function getCondominio(id: string) {
  return CONDOMINIOS.find((c) => c.id === id);
}

export function whatsappUrl(phone: string, msg?: string) {
  const digits = phone.replace(/\D/g, "");
  const q = msg ? `?text=${encodeURIComponent(msg)}` : "";
  return `https://wa.me/${digits}${q}`;
}
