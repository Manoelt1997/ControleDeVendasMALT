// Funções e constantes compartilhadas entre as telas de Estoque, Vendas e Serviços.

export const TABELA_APARELHOS = "estoque_aparelhos";
export const TABELA_PECAS = "estoque_pecas";
export const TABELA_SERVICOS = "estoque_servicos";

export function moeda(v) {
  if (isNaN(v)) return "R$ 0,00";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export function dataBR(d) {
  if (!d) return "—";
  const [ano, mes, dia] = d.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function mesLabel(d) {
  const [ano, mes] = d.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`;
}

export const NOMES_MES_COMPLETO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function ultimoDiaMes(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

// Calcula a data de início e fim (inclusive) do período escolhido no filtro.
export function intervaloPeriodo(filtro, mesPersonalizado) {
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth(); // 0-indexado

  if (filtro === "mes_atual") {
    return { inicio: ymd(anoAtual, mesAtual, 1), fim: ymd(anoAtual, mesAtual, ultimoDiaMes(anoAtual, mesAtual)) };
  }
  if (filtro === "mes_passado") {
    let y = anoAtual, m = mesAtual - 1;
    if (m < 0) { m = 11; y -= 1; }
    return { inicio: ymd(y, m, 1), fim: ymd(y, m, ultimoDiaMes(y, m)) };
  }
  if (filtro === "3meses") {
    let y = anoAtual, m = mesAtual - 2;
    while (m < 0) { m += 12; y -= 1; }
    return { inicio: ymd(y, m, 1), fim: ymd(anoAtual, mesAtual, ultimoDiaMes(anoAtual, mesAtual)) };
  }
  if (filtro === "ano_atual") {
    return { inicio: `${anoAtual}-01-01`, fim: `${anoAtual}-12-31` };
  }
  if (filtro === "personalizado" && mesPersonalizado) {
    const [y, m] = mesPersonalizado.split("-").map(Number);
    return { inicio: ymd(y, m - 1, 1), fim: ymd(y, m - 1, ultimoDiaMes(y, m - 1)) };
  }
  return { inicio: "0000-01-01", fim: "9999-12-31" }; // "tudo"
}

export function labelPeriodo(filtro, mesPersonalizado) {
  const agora = new Date();
  if (filtro === "mes_atual") return `${NOMES_MES_COMPLETO[agora.getMonth()]} de ${agora.getFullYear()}`;
  if (filtro === "mes_passado") {
    let m = agora.getMonth() - 1, y = agora.getFullYear();
    if (m < 0) { m = 11; y -= 1; }
    return `${NOMES_MES_COMPLETO[m]} de ${y}`;
  }
  if (filtro === "3meses") return "últimos 3 meses";
  if (filtro === "ano_atual") return `ano de ${agora.getFullYear()}`;
  if (filtro === "personalizado" && mesPersonalizado) {
    const [y, m] = mesPersonalizado.split("-").map(Number);
    return `${NOMES_MES_COMPLETO[m - 1]} de ${y}`;
  }
  return "todo o período";
}

// ---------- Conversão linha (snake_case) <-> objeto do app (camelCase) ----------
export function linhaParaAparelho(l) {
  return {
    id: l.id,
    modelo: l.modelo,
    marca: l.marca,
    dataEntrada: l.data_entrada,
    valorCompra: Number(l.valor_compra) || 0,
    observacao: l.observacao,
    status: l.status,
    dataSaida: l.data_saida,
    valorVenda: l.valor_venda !== null ? Number(l.valor_venda) : null,
    comprador: l.comprador,
    criadoEm: l.criado_em,
  };
}

export function linhaParaPeca(l) {
  return {
    id: l.id,
    aparelhoId: l.aparelho_id,
    servicoId: l.servico_id,
    nomePeca: l.nome_peca,
    fornecedor: l.fornecedor,
    valor: Number(l.valor) || 0,
    dataCompra: l.data_compra,
    criadoEm: l.criado_em,
  };
}

export function linhaParaServico(l) {
  return {
    id: l.id,
    cliente: l.cliente,
    aparelho: l.aparelho,
    defeito: l.defeito,
    dataEntrada: l.data_entrada,
    valorCobrado: l.valor_cobrado !== null ? Number(l.valor_cobrado) : null,
    status: l.status,
    dataConclusao: l.data_conclusao,
    observacao: l.observacao,
    criadoEm: l.criado_em,
    categoria: l.categoria || "celular",
    numeroSerie: l.numero_serie,
    cor: l.cor,
    senhaDesbloqueio: l.senha_desbloqueio,
    checklistEntrada: l.checklist_entrada || {},
    fotos: l.fotos || [],
  };
}

// ---------- Ordem de Serviço: fluxo de status, checklist por categoria, fotos ----------

export const BUCKET_FOTOS_OS = "os-fotos";

export const ETAPAS_OS = [
  { chave: "aguardando_avaliacao", rotulo: "Aguardando Avaliação", cor: "#8A939D" },
  { chave: "em_diagnostico", rotulo: "Em Diagnóstico", cor: "#5B9BD9" },
  { chave: "aguardando_aprovacao", rotulo: "Aguardando Aprovação", cor: "#D9A63D" },
  { chave: "aguardando_peca", rotulo: "Aguardando Peça", cor: "#D9A63D" },
  { chave: "em_manutencao", rotulo: "Em Manutenção", cor: "#5B9BD9" },
  { chave: "pronto", rotulo: "Pronto / Em Testes", cor: "#4FB8A6" },
  { chave: "entregue", rotulo: "Entregue", cor: "#4FB8A6" },
  { chave: "garantia", rotulo: "Garantia", cor: "#8A67D9" },
];

// Etapas que contam como "concluído" pra fins de faturamento, ranking e dashboard.
export const ETAPAS_CONCLUIDAS = ["entregue", "garantia"];

export function rotuloEtapa(chave) {
  return ETAPAS_OS.find((e) => e.chave === chave)?.rotulo || chave;
}

export function corEtapa(chave) {
  return ETAPAS_OS.find((e) => e.chave === chave)?.cor || "#8A939D";
}

export const CATEGORIAS_OS = [
  { chave: "celular", rotulo: "Celular" },
  { chave: "notebook", rotulo: "Notebook / PC" },
  { chave: "videogame", rotulo: "Videogame" },
];

// Itens do checklist de entrada — variam por categoria de aparelho.
export const CHECKLIST_ITENS = {
  celular: [
    { chave: "tela", rotulo: "Tela" },
    { chave: "touch", rotulo: "Touch" },
    { chave: "biometria", rotulo: "Biometria (digital/face)" },
    { chave: "cameras", rotulo: "Câmeras" },
    { chave: "conectores", rotulo: "Conectores / carregamento" },
    { chave: "sinal_rede", rotulo: "Sinal / rede" },
    { chave: "carcaca", rotulo: "Carcaça" },
  ],
  notebook: [
    { chave: "teclado", rotulo: "Teclado" },
    { chave: "touchpad", rotulo: "Touchpad" },
    { chave: "dobradicas", rotulo: "Dobradiças" },
    { chave: "fonte", rotulo: "Fonte de alimentação" },
    { chave: "armazenamento", rotulo: "Memória / HD / SSD" },
    { chave: "tela", rotulo: "Tela" },
  ],
  videogame: [
    { chave: "drive_disco", rotulo: "Drive de disco" },
    { chave: "saidas", rotulo: "Saídas HDMI / USB" },
    { chave: "conectividade", rotulo: "Wi-Fi / Bluetooth" },
    { chave: "controles", rotulo: "Estado dos controles" },
  ],
};

// Cada item do checklist tem um destes 3 estados.
export const ESTADOS_CHECKLIST = [
  { chave: "nao_testado", rotulo: "Não testado", cor: "#5A626B" },
  { chave: "ok", rotulo: "OK", cor: "#4FB8A6" },
  { chave: "defeito", rotulo: "Defeito", cor: "#D9683D" },
];


// ---------- Séries temporais (dia / mês / ano) para o dashboard analítico ----------

export function ultimosNDias(n) {
  const arr = [];
  const base = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    arr.push(ymd(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return arr;
}

export function ultimosNMeses(n) {
  const arr = [];
  const base = new Date();
  const y = base.getFullYear(), m = base.getMonth();
  for (let i = n - 1; i >= 0; i--) {
    let mm = m - i, yy = y;
    while (mm < 0) { mm += 12; yy -= 1; }
    arr.push(`${yy}-${String(mm + 1).padStart(2, "0")}`);
  }
  return arr;
}

export function ultimosNAnos(n) {
  const arr = [];
  const anoAtual = new Date().getFullYear();
  for (let i = n - 1; i >= 0; i--) arr.push(String(anoAtual - i));
  return arr;
}

// Reduz uma data "AAAA-MM-DD" pra chave da granularidade escolhida.
export function chaveData(dataStr, granularidade) {
  if (!dataStr) return null;
  if (granularidade === "dia") return dataStr;
  if (granularidade === "mes") return dataStr.slice(0, 7);
  if (granularidade === "ano") return dataStr.slice(0, 4);
  return dataStr;
}

export function rotuloCategoria(chave, granularidade) {
  if (granularidade === "dia") {
    const [, m, d] = chave.split("-");
    return `${d}/${m}`;
  }
  if (granularidade === "mes") return mesLabel(chave);
  return chave; // "ano"
}

export function categoriasPorGranularidade(granularidade) {
  if (granularidade === "dia") return ultimosNDias(30);
  if (granularidade === "ano") return ultimosNAnos(5);
  return ultimosNMeses(12);
}
