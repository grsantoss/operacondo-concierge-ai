export type Priority = "Crítica" | "Alta" | "Normal";
export type Category = "Manutenção" | "Segurança" | "Limpeza" | "Administrativo";
export type ColumnId = "novas" | "triagem" | "execucao" | "resolvidas";

export interface TimelineEvent {
  at: string;
  actor: string;
  action: string;
  detail?: string;
  channel?: "WhatsApp" | "Portal" | "Portaria" | "IA" | "Sistema";
}

export interface Message {
  at: string;
  from: "morador" | "sindico" | "ia" | "fornecedor";
  author: string;
  text: string;
}

export interface Demanda {
  id: string;
  title: string;
  description: string;
  morador: string;
  unit: string;
  priority: Priority;
  category: Category;
  age: string;
  createdAt: string;
  sla?: string;
  assigned?: string;
  column: ColumnId;
  location: string;
  contact: { phone: string; email: string };
  attachments: { name: string; size: string; kind: "image" | "pdf" | "video" }[];
  timeline: TimelineEvent[];
  messages: Message[];
  cost?: { estimated: number; approved?: number };
  temperature: "cold" | "warm" | "hot";
}

export const COLUMNS: { id: ColumnId; title: string; accent: string }[] = [
  { id: "novas", title: "Novas", accent: "bg-[var(--color-brand)]" },
  { id: "triagem", title: "Triagem", accent: "bg-[var(--color-warning)]" },
  { id: "execucao", title: "Em execução", accent: "bg-[var(--color-temp-warm)]" },
  { id: "resolvidas", title: "Resolvidas", accent: "bg-[var(--color-success)]" },
];

export const PRIO_CLASS: Record<Priority, string> = {
  Crítica: "bg-red-50 text-red-700 border-red-200",
  Alta: "bg-amber-50 text-amber-700 border-amber-200",
  Normal: "bg-slate-100 text-slate-700 border-slate-200",
};

export const CAT_ICON: Record<Category, string> = {
  Manutenção: "build",
  Segurança: "shield",
  Limpeza: "cleaning_services",
  Administrativo: "description",
};

export const DEMANDAS: Demanda[] = [
  {
    id: "D-2401",
    title: "Vazamento sob a pia da cozinha",
    description:
      "Moradora relata vazamento contínuo sob o gabinete da pia da cozinha desde a manhã de hoje. Água já atinge o rodapé e ameaça infiltrar no apartamento inferior. Registro geral fechado provisoriamente.",
    morador: "Ana Carvalho",
    unit: "Apto 1204",
    priority: "Crítica",
    category: "Manutenção",
    age: "há 4 min",
    createdAt: "Hoje, 09:42",
    sla: "SLA 2h",
    column: "novas",
    location: "Torre A • 12º andar • Apto 1204",
    contact: { phone: "+55 11 98421-1122", email: "ana.carvalho@exemplo.com" },
    attachments: [
      { name: "foto-vazamento-01.jpg", size: "1.2 MB", kind: "image" },
      { name: "foto-vazamento-02.jpg", size: "980 KB", kind: "image" },
    ],
    temperature: "hot",
    timeline: [
      { at: "09:42", actor: "Ana Carvalho", action: "Abriu demanda via WhatsApp", channel: "WhatsApp" },
      { at: "09:43", actor: "Agente IA", action: "Classificou como Crítica — Manutenção hidráulica", channel: "IA" },
      { at: "09:44", actor: "Agente IA", action: "Instruiu fechamento do registro geral", channel: "IA" },
    ],
    messages: [
      { at: "09:42", from: "morador", author: "Ana Carvalho", text: "Tem muita água saindo debaixo da pia! O que faço?" },
      { at: "09:43", from: "ia", author: "Concierge IA", text: "Ana, sinto muito. Você consegue localizar o registro geral do apartamento e fechá-lo? Vou acionar a manutenção agora." },
      { at: "09:44", from: "morador", author: "Ana Carvalho", text: "Consegui fechar, obrigada!" },
    ],
    cost: { estimated: 320 },
  },
  {
    id: "D-2400",
    title: "Câmera do hall do 5º andar offline",
    description:
      "Equipe de portaria detectou que a câmera IP do hall do 5º andar da Torre B está sem sinal desde 08:12. Necessário verificar cabeamento PoE e status do NVR.",
    morador: "Equipe Portaria",
    unit: "Áreas comuns",
    priority: "Alta",
    category: "Segurança",
    age: "há 22 min",
    createdAt: "Hoje, 08:20",
    sla: "SLA 6h",
    column: "novas",
    location: "Torre B • 5º andar • Hall",
    contact: { phone: "+55 11 3333-0000", email: "portaria@edificioaurora.com.br" },
    attachments: [{ name: "log-nvr.pdf", size: "42 KB", kind: "pdf" }],
    temperature: "warm",
    timeline: [
      { at: "08:20", actor: "Portaria", action: "Reportou câmera offline", channel: "Portaria" },
      { at: "08:22", actor: "Agente IA", action: "Categorizou como Segurança — Alta", channel: "IA" },
    ],
    messages: [
      { at: "08:20", from: "morador", author: "Portaria", text: "A câmera do 5º da Torre B caiu de novo." },
      { at: "08:22", from: "ia", author: "Concierge IA", text: "Registrei. Já notifiquei o síndico e sugeri contato com a integradora." },
    ],
    cost: { estimated: 0 },
  },
  {
    id: "D-2399",
    title: "Reserva do salão de festas — sábado 19h",
    description:
      "Morador solicita reserva do salão de festas para sábado a partir das 19h, com estimativa de 30 convidados. Necessário confirmar disponibilidade e regras.",
    morador: "Marcelo Reis",
    unit: "Apto 802",
    priority: "Normal",
    category: "Administrativo",
    age: "há 38 min",
    createdAt: "Hoje, 08:04",
    column: "novas",
    location: "Salão de festas • Térreo",
    contact: { phone: "+55 11 99911-2020", email: "marcelo.reis@exemplo.com" },
    attachments: [],
    temperature: "cold",
    timeline: [
      { at: "08:04", actor: "Marcelo Reis", action: "Solicitou reserva via portal", channel: "Portal" },
      { at: "08:05", actor: "Agente IA", action: "Verificou agenda — data disponível", channel: "IA" },
    ],
    messages: [
      { at: "08:04", from: "morador", author: "Marcelo Reis", text: "Gostaria de reservar o salão sábado, 19h." },
      { at: "08:05", from: "ia", author: "Concierge IA", text: "A data está livre! Precisa apenas da aprovação do síndico." },
    ],
    cost: { estimated: 0 },
  },
  {
    id: "D-2395",
    title: "Elevador social com ruído ao subir",
    description:
      "Diversos moradores relatam ruído metálico no elevador social da Torre A a partir do 6º andar. Técnico da Otis já foi acionado para inspeção preventiva.",
    morador: "Júlia Tavares",
    unit: "Apto 506",
    priority: "Alta",
    category: "Manutenção",
    age: "há 1h",
    createdAt: "Hoje, 07:44",
    sla: "SLA 8h",
    assigned: "Roberto S.",
    column: "triagem",
    location: "Torre A • Elevador social",
    contact: { phone: "+55 11 98800-4455", email: "julia.t@exemplo.com" },
    attachments: [{ name: "audio-elevador.mp4", size: "3.4 MB", kind: "video" }],
    temperature: "warm",
    timeline: [
      { at: "07:44", actor: "Júlia Tavares", action: "Reportou ruído", channel: "WhatsApp" },
      { at: "07:50", actor: "Roberto S.", action: "Assumiu triagem" },
      { at: "08:10", actor: "Sistema", action: "Chamado aberto na Otis #A-9921", channel: "Sistema" },
    ],
    messages: [
      { at: "07:44", from: "morador", author: "Júlia Tavares", text: "O elevador social está fazendo barulho estranho ao subir." },
      { at: "08:11", from: "sindico", author: "Roberto S.", text: "Obrigado pelo aviso, Júlia. Técnico virá ainda hoje." },
    ],
    cost: { estimated: 480 },
  },
  {
    id: "D-2392",
    title: "Cheiro forte no corredor do 3º andar",
    description:
      "Vários moradores relataram cheiro forte, possivelmente de mofo, no corredor do 3º andar. Equipe de limpeza foi orientada a inspecionar e higienizar.",
    morador: "Diversos",
    unit: "Áreas comuns",
    priority: "Normal",
    category: "Limpeza",
    age: "há 2h",
    createdAt: "Hoje, 06:50",
    assigned: "Carla M.",
    column: "triagem",
    location: "Torre A • 3º andar • Corredor",
    contact: { phone: "+55 11 3333-0000", email: "limpeza@edificioaurora.com.br" },
    attachments: [],
    temperature: "cold",
    timeline: [
      { at: "06:50", actor: "Portaria", action: "Registrou reclamações", channel: "Portaria" },
      { at: "07:15", actor: "Carla M.", action: "Assumiu triagem" },
    ],
    messages: [
      { at: "07:20", from: "sindico", author: "Carla M.", text: "Equipe de limpeza vai verificar às 10h." },
    ],
    cost: { estimated: 120 },
  },
  {
    id: "D-2380",
    title: "Troca de lâmpadas — garagem nível -2",
    description: "Substituição programada de 12 lâmpadas LED na garagem nível -2. Fornecedor ElétricaPro em execução.",
    morador: "Manutenção",
    unit: "Garagem",
    priority: "Normal",
    category: "Manutenção",
    age: "há 5h",
    createdAt: "Hoje, 04:00",
    assigned: "ElétricaPro",
    column: "execucao",
    location: "Garagem • Nível -2",
    contact: { phone: "+55 11 4020-9090", email: "atendimento@eletricapro.com.br" },
    attachments: [{ name: "orcamento-eletricapro.pdf", size: "88 KB", kind: "pdf" }],
    temperature: "cold",
    timeline: [
      { at: "Ontem 18:00", actor: "Roberto S.", action: "Aprovou orçamento" },
      { at: "04:00", actor: "ElétricaPro", action: "Iniciou execução" },
    ],
    messages: [
      { at: "04:02", from: "fornecedor", author: "ElétricaPro", text: "Equipe no local, iniciando substituição." },
    ],
    cost: { estimated: 640, approved: 640 },
  },
  {
    id: "D-2378",
    title: "Manutenção preventiva piscina",
    description: "Manutenção preventiva mensal da piscina — análise química, filtragem e limpeza de bordas.",
    morador: "Equipe Operação",
    unit: "Lazer",
    priority: "Normal",
    category: "Manutenção",
    age: "há 1d",
    createdAt: "Ontem, 09:00",
    assigned: "AquaService",
    column: "execucao",
    location: "Área de lazer • Piscina",
    contact: { phone: "+55 11 3021-7777", email: "contato@aquaservice.com.br" },
    attachments: [],
    temperature: "cold",
    timeline: [
      { at: "Ontem 09:00", actor: "Sistema", action: "Rotina mensal disparada", channel: "Sistema" },
    ],
    messages: [],
    cost: { estimated: 890, approved: 890 },
  },
  {
    id: "D-2370",
    title: "Reforço de ronda — fim de semana",
    description: "Solicitação do conselho para reforço de ronda motorizada durante o fim de semana em razão de evento no bairro.",
    morador: "Conselho",
    unit: "Geral",
    priority: "Alta",
    category: "Segurança",
    age: "há 1d",
    createdAt: "Ontem, 10:30",
    assigned: "Guarda24",
    column: "execucao",
    location: "Perímetro externo",
    contact: { phone: "+55 11 4004-2424", email: "operacoes@guarda24.com.br" },
    attachments: [{ name: "ata-conselho.pdf", size: "210 KB", kind: "pdf" }],
    temperature: "warm",
    timeline: [
      { at: "Ontem 10:30", actor: "Conselho", action: "Solicitou reforço" },
      { at: "Ontem 14:00", actor: "Roberto S.", action: "Contratou Guarda24" },
    ],
    messages: [],
    cost: { estimated: 1200, approved: 1200 },
  },
  {
    id: "D-2365",
    title: "Boleto duplicado — outubro",
    description: "Morador identificou boleto duplicado referente à taxa condominial de outubro. Estorno processado e comprovante enviado.",
    morador: "Bruno Lima",
    unit: "Cobertura 02",
    priority: "Normal",
    category: "Administrativo",
    age: "ontem",
    createdAt: "Ontem, 11:20",
    column: "resolvidas",
    location: "Financeiro",
    contact: { phone: "+55 11 98120-7788", email: "bruno.lima@exemplo.com" },
    attachments: [{ name: "comprovante-estorno.pdf", size: "56 KB", kind: "pdf" }],
    temperature: "cold",
    timeline: [
      { at: "Ontem 11:20", actor: "Bruno Lima", action: "Abriu chamado" },
      { at: "Ontem 15:45", actor: "Financeiro", action: "Processou estorno" },
      { at: "Ontem 16:00", actor: "Sistema", action: "Enviou comprovante", channel: "Sistema" },
    ],
    messages: [
      { at: "Ontem 16:01", from: "sindico", author: "Financeiro", text: "Bruno, o estorno foi realizado, obrigado pela paciência." },
    ],
    cost: { estimated: 0 },
  },
  {
    id: "D-2362",
    title: "Portão da garagem travado",
    description: "Portão social da garagem travou na posição aberta. Técnico veio, substituiu o sensor e o portão voltou a operar normalmente.",
    morador: "Portaria",
    unit: "Garagem",
    priority: "Crítica",
    category: "Manutenção",
    age: "ontem",
    createdAt: "Ontem, 07:12",
    column: "resolvidas",
    location: "Garagem • Portão social",
    contact: { phone: "+55 11 3333-0000", email: "portaria@edificioaurora.com.br" },
    attachments: [],
    temperature: "hot",
    timeline: [
      { at: "Ontem 07:12", actor: "Portaria", action: "Reportou travamento" },
      { at: "Ontem 09:30", actor: "PortõesJá", action: "Substituiu sensor" },
      { at: "Ontem 09:45", actor: "Portaria", action: "Confirmou funcionamento" },
    ],
    messages: [],
    cost: { estimated: 420, approved: 420 },
  },
];

export function getDemanda(id: string): Demanda | undefined {
  return DEMANDAS.find((d) => d.id === id);
}

export function getRelatedDemandas(id: string): Demanda[] {
  const current = getDemanda(id);
  if (!current) return [];
  return DEMANDAS.filter(
    (d) => d.id !== id && (d.category === current.category || d.unit === current.unit),
  ).slice(0, 3);
}

export function getAdjacent(id: string): { prev?: Demanda; next?: Demanda } {
  const idx = DEMANDAS.findIndex((d) => d.id === id);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? DEMANDAS[idx - 1] : undefined,
    next: idx < DEMANDAS.length - 1 ? DEMANDAS[idx + 1] : undefined,
  };
}

export function resolveDemanda(id: string, actor = "Síndico"): Demanda | undefined {
  const d = DEMANDAS.find((x) => x.id === id);
  if (!d) return undefined;
  if (d.column === "resolvidas") return d;
  d.column = "resolvidas";
  d.sla = undefined;
  d.age = "agora";
  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  d.timeline = [
    ...d.timeline,
    { at: now, actor, action: "Marcou a demanda como resolvida", channel: "Sistema" },
  ];
  return d;
}

let _nextDemandaSeq = 2402;
export function createDemanda(input: {
  title: string;
  description: string;
  morador: string;
  unit: string;
  priority: Priority;
  category: Category;
  location: string;
  contact: { phone: string; email: string };
  cost?: { estimated: number };
}): Demanda {
  const id = `D-${_nextDemandaSeq++}`;
  const now = new Date();
  const hhmm = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const d: Demanda = {
    id,
    title: input.title,
    description: input.description,
    morador: input.morador,
    unit: input.unit,
    priority: input.priority,
    category: input.category,
    age: "agora",
    createdAt: `Hoje, ${hhmm}`,
    column: "novas",
    location: input.location,
    contact: input.contact,
    attachments: [],
    temperature: input.priority === "Crítica" ? "hot" : input.priority === "Alta" ? "warm" : "cold",
    timeline: [{ at: hhmm, actor: input.morador, action: "Abriu demanda", channel: "Portal" }],
    messages: [],
    cost: input.cost,
  };
  DEMANDAS.unshift(d);
  return d;
}
