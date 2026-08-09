import { useState, useEffect, useMemo } from "react";
import { supabase, supabaseConfigurado, TABELA_ORDENS } from "./supabaseClient";
import Estoque from "./Estoque";

// ---------- Referência de demanda e PREÇO DE REVENDA (seminovo) por modelo ----------
// Faixa = o que o aparelho seminovo (já consertado, funcionando) tende a ser VENDIDO por,
// não o preço de compra do defeituoso. É a base para calcular a margem alvo.
// Atualizado em 09/08/2026 a partir de fontes agregadas (Trocafone, Trocafy, TechTudo,
// TechLoad, Canaltech, Zoom, Buscapé) e os comparáveis regionais de Jaraguá do Sul abaixo.
// Ainda é uma REFERÊNCIA, não um preço travado — o mercado de seminovo varia por estado de
// bateria, tela e capacidade (GB). Modelos mais antigos (iPhone 8 em diante, Galaxy A30/S20
// em diante) foram adicionados com faixas mais largas, já que há menos padronização de preço
// nesses aparelhos.
const DATA_REFERENCIA_NACIONAL = "09/08/2026";
const REFERENCIA_MODELOS = [
  { chave: "iphone 15", demanda: "Alta", faixa: [3800, 4500] },
  { chave: "iphone 14", demanda: "Alta", faixa: [2600, 3200] },
  { chave: "iphone 13", demanda: "Alta", faixa: [2000, 2500] },
  { chave: "iphone 12", demanda: "Alta", faixa: [1600, 2100] },
  { chave: "iphone 11", demanda: "Média", faixa: [1700, 2000] },
  { chave: "iphone se", demanda: "Média", faixa: [900, 1400] },
  { chave: "iphone xs max", demanda: "Baixa", faixa: [950, 1350] },
  { chave: "iphone xs", demanda: "Baixa", faixa: [800, 1150] },
  { chave: "iphone xr", demanda: "Média", faixa: [700, 1050] },
  { chave: "iphone x", demanda: "Baixa", faixa: [700, 1050] },
  { chave: "iphone 8 plus", demanda: "Baixa", faixa: [650, 950] },
  { chave: "iphone 8", demanda: "Baixa", faixa: [550, 850] },
  { chave: "galaxy s25", demanda: "Alta", faixa: [2400, 3200] },
  { chave: "galaxy s23", demanda: "Alta", faixa: [1800, 2800] },
  { chave: "galaxy s22", demanda: "Alta", faixa: [1400, 2200] },
  { chave: "galaxy s21", demanda: "Média", faixa: [1000, 1700] },
  { chave: "galaxy s20", demanda: "Baixa", faixa: [700, 1200] },
  { chave: "galaxy a54", demanda: "Alta", faixa: [1100, 1600] },
  { chave: "galaxy a34", demanda: "Alta", faixa: [900, 1300] },
  { chave: "galaxy a17", demanda: "Alta", faixa: [700, 950] },
  { chave: "galaxy a15", demanda: "Alta", faixa: [550, 800] },
  { chave: "galaxy a14", demanda: "Alta", faixa: [600, 900] },
  { chave: "galaxy a30s", demanda: "Baixa", faixa: [450, 650] },
  { chave: "galaxy a30", demanda: "Baixa", faixa: [400, 550] },
  { chave: "galaxy a04", demanda: "Média", faixa: [450, 650] },
  { chave: "redmi note 12", demanda: "Alta", faixa: [650, 950] },
  { chave: "redmi note 11", demanda: "Alta", faixa: [550, 850] },
  { chave: "redmi 12", demanda: "Média", faixa: [500, 750] },
  { chave: "poco x5", demanda: "Média", faixa: [700, 1000] },
  { chave: "moto g84", demanda: "Média", faixa: [900, 1400] },
  { chave: "moto g54", demanda: "Média", faixa: [600, 900] },
  { chave: "moto g34", demanda: "Média", faixa: [500, 750] },
  { chave: "moto g73", demanda: "Baixa", faixa: [600, 900] },
];

function buscarReferencia(modelo) {
  const m = modelo.toLowerCase().trim();
  if (!m) return null;
  let melhor = null;
  for (const r of REFERENCIA_MODELOS) {
    if (m.includes(r.chave)) {
      if (!melhor || r.chave.length > melhor.chave.length) melhor = r;
    }
  }
  return melhor;
}

// ---------- Comparáveis reais coletados em Jaraguá do Sul, SC (OLX) ----------
// Preços PEDIDOS em anúncios ativos no momento da coleta — não são valores de fechamento,
// nem vêm do Facebook Marketplace (inacessível sem login) ou de uma varredura completa do
// Mercado Livre. Servem como âncora local, não como verdade absoluta.
const DATA_COLETA_REGIONAL = "06/08/2026";
const REGIONAL_JARAGUA = [
  { modelo: "iPhone 11", preco: 1285, tipo: "particular" },
  { modelo: "iPhone 12", preco: 1350, tipo: "particular" },
  { modelo: "iPhone 13", preco: 2000, tipo: "particular" },
  { modelo: "iPhone 13", preco: 2290, tipo: "particular" },
  { modelo: "iPhone 13 Pro Max", preco: 2600, tipo: "particular" },
  { modelo: "iPhone 14", preco: 2090, tipo: "particular" },
  { modelo: "iPhone 14", preco: 2299, tipo: "particular" },
  { modelo: "iPhone 15 Pro", preco: 3999, tipo: "particular" },
  { modelo: "iPhone 16 Pro Max", preco: 7650, tipo: "loja" },
  { modelo: "iPhone 17 Pro", preco: 6750, tipo: "loja" },
  { modelo: "Galaxy A16 5G", preco: 650, tipo: "particular" },
  { modelo: "Galaxy A54 5G", preco: 600, tipo: "particular" },
  { modelo: "Galaxy S26 Ultra", preco: 6350, tipo: "loja" },
  { modelo: "Redmi Note 10 Pro", preco: 600, tipo: "particular" },
  { modelo: "Redmi Note 11", preco: 627, tipo: "particular" },
  { modelo: "Redmi Note 13", preco: 780, tipo: "particular" },
  { modelo: "Redmi Note 13", preco: 800, tipo: "particular" },
  { modelo: "Moto G84 5G", preco: 700, tipo: "particular" },
  { modelo: "Poco X6", preco: 1300, tipo: "particular" },
  { modelo: "Poco X7", preco: 1550, tipo: "loja" },
];

function buscarComparaveisRegionais(modelo) {
  const m = modelo.toLowerCase().trim();
  if (m.length < 4) return [];
  return REGIONAL_JARAGUA.filter((item) => {
    const im = item.modelo.toLowerCase();
    return im.includes(m) || m.includes(im);
  });
}

// ---------- Detecção de marca (ícone estilizado próprio, não é logo oficial) ----------
const MARCAS = {
  apple: { label: "Apple", accent: "#C9C9CE", trigger: ["iphone"] },
  samsung: { label: "Samsung", accent: "#3F6FE0", trigger: ["galaxy", "samsung"] },
  xiaomi: { label: "Xiaomi", accent: "#FF7A1A", trigger: ["redmi", "poco", "xiaomi", "mi "] },
  motorola: { label: "Motorola", accent: "#8B5CF6", trigger: ["moto", "motorola"] },
};

function detectarMarca(modelo) {
  const m = modelo.toLowerCase();
  for (const key in MARCAS) {
    if (MARCAS[key].trigger.some((t) => m.includes(t))) return MARCAS[key];
  }
  return null;
}

// Ícone genérico de aparelho — desenhado, não é foto real do produto
function IconeAparelho({ accent = "#4FB8A6" }) {
  return (
    <svg width="56" height="96" viewBox="0 0 56 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="52" height="92" rx="10" fill="#14171A" stroke={accent} strokeWidth="2" />
      <rect x="7" y="9" width="42" height="72" rx="3" fill={accent} fillOpacity="0.12" stroke={accent} strokeOpacity="0.5" strokeWidth="1" />
      <rect x="21" y="4.5" width="14" height="3" rx="1.5" fill={accent} fillOpacity="0.6" />
      <circle cx="28" cy="88" r="2.4" fill={accent} fillOpacity="0.6" />
    </svg>
  );
}

const MARGEM_SUGERIDA = { Alta: 28, Média: 38, Baixa: 50 };
const DEMANDA_INFO = {
  Alta: { cor: "#4FB8A6", texto: "Venda rápida — margem mais enxuta compensa pelo giro." },
  Média: { cor: "#D9A63D", texto: "Giro moderado — margem intermediária." },
  Baixa: { cor: "#D9683D", texto: "Pode ficar parado — cobre o risco com margem maior." },
};
const DEFEITOS = ["Tela", "Conector de carga", "Bateria", "Tela + Bateria", "Tela + Conector", "Outro"];

function moeda(v) {
  if (isNaN(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const VEREDITO_INFO = {
  boa: { label: "Vale a pena", cor: "#4FB8A6" },
  ressalva: { label: "Vale a pena com ressalvas", cor: "#D9A63D" },
  ruim: { label: "Não vale a pena", cor: "#D9683D" },
};

// Avalia se o negócio compensa considerando custo da peça, margem mínima e demanda
function avaliarNegocio({ custoTotal, nPeca, margemAlvo, margemMinimaN, precoSugerido, demanda, ref }) {
  if (custoTotal <= 0) return null;
  const lucroAlvo = precoSugerido - custoTotal;
  const motivos = [];
  let nivel = "boa";

  if (lucroAlvo <= 0) {
    nivel = "ruim";
    motivos.push("O preço sugerido não cobre nem o custo total — resultaria em prejuízo.");
  } else {
    if (lucroAlvo < 80) {
      nivel = "ruim";
      motivos.push(`O lucro em reais (${moeda(lucroAlvo)}) fica abaixo de R$ 80 — não vale a pena pelo tempo e risco do reparo.`);
    } else if (margemAlvo < margemMinimaN) {
      nivel = "ressalva";
      motivos.push(`A margem alvo (${margemAlvo}%) está abaixo da margem mínima que você definiu (${margemMinimaN}%).`);
    }
    const ratioPeca = nPeca / custoTotal;
    if (ratioPeca > 0.5) {
      if (nivel !== "ruim") nivel = "ressalva";
      motivos.push("O custo da peça representa mais da metade do investimento — risco maior se a peça genérica falhar ou o defeito real for outro.");
    }
    if (ref && precoSugerido > ref.faixa[1]) {
      if (nivel !== "ruim") nivel = "ressalva";
      motivos.push("O preço sugerido ficou acima da faixa normalmente praticada para este modelo — pode ser difícil vender por esse valor.");
    }
    if (demanda === "Baixa") {
      if (nivel === "boa") nivel = "ressalva";
      motivos.push("Demanda estimada baixa — o aparelho pode demorar a vender, aumentando o custo de oportunidade do capital parado.");
    }
  }

  if (motivos.length === 0) motivos.push("Custo do aparelho, custo da peça, margem e demanda estimada estão equilibrados.");
  return { nivel, motivos, lucroAlvo };
}

// ---------- Conversão entre o formato usado no app (camelCase) e as colunas do
// Supabase (snake_case) ----------
function linhaParaOrdem(linha) {
  return {
    id: linha.id,
    modelo: linha.modelo,
    marca: linha.marca,
    defeito: linha.defeito,
    valorCompra: Number(linha.valor_compra) || 0,
    custoPeca: Number(linha.custo_peca) || 0,
    maoDeObra: Number(linha.mao_de_obra) || 0,
    custoDinheiro: Number(linha.custo_dinheiro) || 0,
    demanda: linha.demanda,
    margemAlvo: Number(linha.margem_alvo) || 0,
    margemMinimaN: Number(linha.margem_minima) || 0,
    precoEquilibrio: Number(linha.preco_equilibrio) || 0,
    precoMinimo: Number(linha.preco_minimo) || 0,
    precoSugerido: Number(linha.preco_sugerido) || 0,
    lucroAlvo: Number(linha.lucro_alvo) || 0,
    precoMercado: Number(linha.preco_mercado) || 0,
    veredito: linha.veredito,
    fotoUrl: linha.foto_url,
    criadoEm: linha.criado_em,
  };
}

function ordemParaLinha(o) {
  return {
    modelo: o.modelo,
    marca: o.marca,
    defeito: o.defeito,
    valor_compra: o.valorCompra,
    custo_peca: o.custoPeca,
    mao_de_obra: o.maoDeObra,
    custo_dinheiro: o.custoDinheiro,
    demanda: o.demanda,
    margem_alvo: o.margemAlvo,
    margem_minima: o.margemMinimaN,
    preco_equilibrio: o.precoEquilibrio,
    preco_minimo: o.precoMinimo,
    preco_sugerido: o.precoSugerido,
    lucro_alvo: o.lucroAlvo,
    preco_mercado: o.precoMercado,
    veredito: o.veredito,
    foto_url: o.fotoUrl || null,
  };
}

// ---------- Busca uma foto de referência do aparelho na Wikipédia (gratuito,
// sem chave de API). Pode não achar nada pra modelos muito novos/nicho — nesse
// caso o app cai pro ícone ilustrado. ----------
async function buscarFotoWikipedia(termo, sinal) {
  const buscaUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    termo
  )}&format=json&origin=*&srlimit=1`;
  const buscaResp = await fetch(buscaUrl, { signal: sinal });
  if (!buscaResp.ok) return null;
  const buscaData = await buscaResp.json();
  const titulo = buscaData?.query?.search?.[0]?.title;
  if (!titulo) return null;

  const resumoUrl = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    titulo
  )}`;
  const resumoResp = await fetch(resumoUrl, { signal: sinal });
  if (!resumoResp.ok) return null;
  const resumoData = await resumoResp.json();
  return resumoData?.thumbnail?.source || resumoData?.originalimage?.source || null;
}

export default function App() {
  const [carregando, setCarregando] = useState(true);
  const [ordens, setOrdens] = useState([]);
  const [erroStorage, setErroStorage] = useState(false);
  const [aba, setAba] = useState("calculadora");

  const [modelo, setModelo] = useState("");
  const [defeito, setDefeito] = useState(DEFEITOS[0]);
  const [valorCompra, setValorCompra] = useState("");
  const [custoPeca, setCustoPeca] = useState("");
  const [maoDeObra, setMaoDeObra] = useState("");
  const [precoMercado, setPrecoMercado] = useState("");
  const [demandaManual, setDemandaManual] = useState("");
  const [margemManual, setMargemManual] = useState("");
  const [margemMinima, setMargemMinima] = useState("");
  const [fotoUrl, setFotoUrl] = useState(null);
  const [fotoCarregando, setFotoCarregando] = useState(false);

  // Carrega as ordens do Supabase e assina atualizações em tempo real: qualquer
  // registro ou remoção feita em outro aparelho (celular, computador) aparece
  // aqui na hora, sem precisar recarregar a página.
  useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregando(false);
      return;
    }

    let ativo = true;

    async function carregarInicial() {
      const { data, error } = await supabase
        .from(TABELA_ORDENS)
        .select("*")
        .order("criado_em", { ascending: false });
      if (!ativo) return;
      if (error) {
        setErroStorage(true);
      } else {
        setOrdens(data.map(linhaParaOrdem));
        setErroStorage(false);
      }
      setCarregando(false);
    }
    carregarInicial();

    const canal = supabase
      .channel("ordens-tempo-real")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABELA_ORDENS },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const nova = linhaParaOrdem(payload.new);
            setOrdens((atual) =>
              atual.some((o) => o.id === nova.id) ? atual : [nova, ...atual]
            );
          } else if (payload.eventType === "DELETE") {
            setOrdens((atual) => atual.filter((o) => o.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            const atualizada = linhaParaOrdem(payload.new);
            setOrdens((atual) =>
              atual.map((o) => (o.id === atualizada.id ? atualizada : o))
            );
          }
        }
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  // Busca uma foto de referência do modelo digitado (Wikipédia), com debounce
  // pra não disparar uma busca a cada tecla.
  useEffect(() => {
    const termo = modelo.trim();
    if (termo.length < 3) {
      setFotoUrl(null);
      setFotoCarregando(false);
      return;
    }
    const controlador = new AbortController();
    setFotoCarregando(true);
    const timer = setTimeout(async () => {
      try {
        const foto = await buscarFotoWikipedia(termo, controlador.signal);
        setFotoUrl(foto);
      } catch (e) {
        if (e.name !== "AbortError") setFotoUrl(null);
      } finally {
        setFotoCarregando(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controlador.abort();
    };
  }, [modelo]);

  const ref = useMemo(() => buscarReferencia(modelo), [modelo]);
  const marca = useMemo(() => detectarMarca(modelo), [modelo]);
  const comparaveis = useMemo(() => buscarComparaveisRegionais(modelo), [modelo]);
  const demanda = demandaManual || (ref ? ref.demanda : "Média");

  const nCompra = Number(valorCompra) || 0;
  const nPeca = Number(custoPeca) || 0;
  const nMao = Number(maoDeObra) || 0;
  // Base de cálculo do lucro: só o que realmente saiu do seu bolso (compra do aparelho
  // defeituoso + peça). Mão de obra é seu próprio trabalho, não um custo em dinheiro,
  // então fica de fora do lucro — é só informativa.
  const custoDinheiro = nCompra + nPeca;
  const margemMinimaN = margemMinima !== "" ? Number(margemMinima) : 20;

  // Estatísticas dos comparáveis regionais
  const precosComparaveis = comparaveis.map((c) => c.preco);
  const mediaRegional = precosComparaveis.length
    ? precosComparaveis.reduce((a, b) => a + b, 0) / precosComparaveis.length
    : null;
  const minRegional = precosComparaveis.length ? Math.min(...precosComparaveis) : null;
  const maxRegional = precosComparaveis.length ? Math.max(...precosComparaveis) : null;
  // Sugere vender ~8% abaixo do pedido na região: aparelho reparado (peça não original)
  // compete com aparelhos originais, então precisa de um preço mais assertivo para vender rápido.
  const precoAlvoRegional = mediaRegional ? mediaRegional * 0.92 : null;

  const nMercado = Number(precoMercado) || 0;

  // ---------- Preços de VENDA sugeridos (alto / médio / baixo) ----------
  // Ancorados no que o seminovo já consertado realmente vende por, na ordem de confiança:
  // 1) preço de mercado que você mesmo viu  2) comparáveis reais de Jaraguá do Sul
  // 3) referência nacional pesquisada por modelo.
  const origemVenda = nMercado > 0 ? "mercado" : comparaveis.length > 0 ? "regional" : ref ? "nacional" : null;

  const ORIGEM_VENDA_LABEL = {
    mercado: "no preço de mercado que você informou",
    regional: "nos comparáveis reais de Jaraguá do Sul (ajustados -8%, pois é aparelho reparado)",
    nacional: "na referência nacional pesquisada para este modelo",
  };

  let vendaBaixa = null;
  let vendaMedia = null;
  let vendaAlta = null;

  if (origemVenda === "mercado") {
    vendaBaixa = nMercado * 0.92;
    vendaMedia = nMercado;
    vendaAlta = nMercado * 1.08;
  } else if (origemVenda === "regional") {
    vendaBaixa = minRegional * 0.92;
    vendaMedia = precoAlvoRegional;
    vendaAlta = maxRegional * 0.92;
  } else if (origemVenda === "nacional") {
    vendaBaixa = ref.faixa[0];
    vendaMedia = (ref.faixa[0] + ref.faixa[1]) / 2;
    vendaAlta = ref.faixa[1];
  }

  // Sem nenhuma referência de mercado: cai para a margem heurística por demanda, só como piso.
  const margemAlvo = margemManual !== "" ? Number(margemManual) : MARGEM_SUGERIDA[demanda];
  const precoSugerido = vendaMedia !== null ? vendaMedia : custoDinheiro * (1 + margemAlvo / 100);
  const precoEquilibrio = custoDinheiro;
  const precoMinimo = custoDinheiro * (1 + margemMinimaN / 100);
  const lucroAlvo = precoSugerido - custoDinheiro;
  const acimaDoMercado = nMercado > 0 && precoSugerido > nMercado;

  function lucroEVeredito(venda) {
    if (venda === null || venda === undefined) return null;
    const lucro = venda - custoDinheiro;
    const margemPct = custoDinheiro > 0 ? (lucro / custoDinheiro) * 100 : null;
    let veredito = "boa";
    if (custoDinheiro <= 0) veredito = null;
    else if (lucro <= 0 || lucro < 80) veredito = "ruim";
    else if (margemPct !== null && margemPct < margemMinimaN) veredito = "ressalva";
    return { lucro, margemPct, veredito };
  }

  const avaliacao = useMemo(
    () => avaliarNegocio({ custoTotal: custoDinheiro, nPeca, margemAlvo, margemMinimaN, precoSugerido, demanda, ref }),
    [custoDinheiro, nPeca, margemAlvo, margemMinimaN, precoSugerido, demanda, ref]
  );

  function limparForm() {
    setModelo("");
    setDefeito(DEFEITOS[0]);
    setValorCompra("");
    setCustoPeca("");
    setMaoDeObra("");
    setPrecoMercado("");
    setDemandaManual("");
    setMargemManual("");
    setMargemMinima("");
  }

  const [salvando, setSalvando] = useState(false);

  async function registrarOrdem() {
    if (!modelo.trim() || custoDinheiro <= 0 || !supabaseConfigurado) return;
    const nova = {
      modelo: modelo.trim(),
      marca: marca ? marca.label : null,
      defeito,
      valorCompra: nCompra,
      custoPeca: nPeca,
      maoDeObra: nMao,
      custoDinheiro,
      demanda,
      margemAlvo,
      margemMinimaN,
      precoEquilibrio,
      precoMinimo,
      precoSugerido,
      lucroAlvo,
      precoMercado: nMercado,
      veredito: avaliacao ? avaliacao.nivel : null,
      fotoUrl,
    };
    setSalvando(true);
    const { error } = await supabase.from(TABELA_ORDENS).insert(ordemParaLinha(nova));
    setSalvando(false);
    if (error) {
      setErroStorage(true);
      return;
    }
    setErroStorage(false);
    // A lista some sincronizada pelo evento em tempo real (postgres_changes),
    // então aqui só limpamos o formulário.
    limparForm();
  }

  async function removerOrdem(id) {
    const { error } = await supabase.from(TABELA_ORDENS).delete().eq("id", id);
    if (error) setErroStorage(true);
  }

  // Usa um dos preços de venda sugeridos como "preço visto no mercado", que passa a
  // ser a referência prioritária para o restante do cálculo.
  function usarPrecoVenda(v) {
    if (v === null || v === undefined || isNaN(v)) return;
    setPrecoMercado(String(Math.max(0, Math.round(v))));
  }

  const totalInvestido = ordens.reduce((s, o) => s + o.custoDinheiro, 0);
  const totalLucroPrevisto = ordens.reduce((s, o) => s + o.lucroAlvo, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#14171A",
        color: "#EDEFF1",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      className="page-pad"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .display { font-family: 'Space Grotesk', sans-serif; }
        input, select {
          background: #1E2228;
          border: 1px solid #2C3138;
          color: #EDEFF1;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 16px;
          font-family: 'Inter', sans-serif;
          width: 100%;
          box-sizing: border-box;
          outline: none;
        }
        input:focus, select:focus { border-color: #4FB8A6; }
        input::placeholder { color: #5A626B; }
        label { font-size: 12px; color: #8A939D; display: block; margin-bottom: 6px; letter-spacing: 0.02em; }
        .field { margin-bottom: 14px; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #4FB8A6; outline-offset: 2px; }

        /* ---- Responsivo: colunas empilham em telas estreitas ---- */
        .page-pad { padding: 32px 20px 80px; }
        .grid-main { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.1fr); gap: 24px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .grid-2-16 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .grid-3-18 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        .history-row {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr auto;
          align-items: center;
          gap: 12px;
        }
        .history-head {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr auto;
          gap: 12px;
          padding: 0 16px;
          margin-bottom: 6px;
          font-size: 10.5px;
          color: #5A626B;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .history-tag { display: none; }

        @media (max-width: 860px) {
          .grid-main { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .page-pad { padding: 20px 14px 64px; }
          h1.app-title { font-size: 24px !important; }
          .grid-2, .grid-2-16, .grid-3, .grid-3-18 { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .history-head { display: none; }
          .history-row {
            grid-template-columns: 1fr 1fr;
            row-gap: 10px;
            position: relative;
            padding-right: 40px !important;
          }
          .history-row > div:nth-child(1) { grid-column: 1 / -1; }
          .history-row > button {
            position: absolute;
            top: 12px;
            right: 12px;
            padding: 4px 8px !important;
            font-size: 11px !important;
          }
          .history-tag { display: block; font-size: 9.5px; color: #5A626B; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
        }
      `}</style>

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <span className="mono" style={{ color: "#4FB8A6", fontSize: 13 }}>
            OS-CTRL
          </span>
          <div style={{ flex: 1, height: 1, background: "#2C3138" }} />
        </div>
        <h1 className="display app-title" style={{ fontSize: 30, fontWeight: 700, margin: "0 0 4px" }}>
          Controle de compra e reparo de celulares
        </h1>
        <p style={{ color: "#8A939D", fontSize: 14, margin: "0 0 8px", maxWidth: 640 }}>
          Registre o aparelho com defeito, o custo da peça e veja se o negócio compensa antes de
          fechar a compra.
        </p>
        <p style={{ color: "#5A626B", fontSize: 12, margin: "0 0 32px", maxWidth: 640 }}>
          Ao digitar o modelo, o app busca uma foto de referência na Wikipédia. Quando não
          encontra (modelo muito novo, nicho ou digitado de forma incomum), mostra um ícone
          ilustrado no lugar — a foto é só uma referência visual, confira o modelo antes de
          fechar negócio.
        </p>

        {!supabaseConfigurado && (
          <div
            style={{
              background: "#D9A63D22",
              border: "1px solid #D9A63D55",
              color: "#D9A63D",
              borderRadius: 8,
              padding: "14px 18px",
              fontSize: 13,
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            <strong>Supabase não configurado.</strong> O app está funcionando, mas nada vai ser
            salvo ou sincronizado. Defina <code>VITE_SUPABASE_URL</code> e{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> (veja o <code>.env.example</code> e o README) e
            recarregue a página.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setAba("calculadora")}
            className="mono"
            style={{
              background: aba === "calculadora" ? "#4FB8A622" : "transparent",
              border: `1px solid ${aba === "calculadora" ? "#4FB8A6" : "#2C3138"}`,
              color: aba === "calculadora" ? "#4FB8A6" : "#8A939D",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            CALCULADORA
          </button>
          <button
            onClick={() => setAba("estoque")}
            className="mono"
            style={{
              background: aba === "estoque" ? "#4FB8A622" : "transparent",
              border: `1px solid ${aba === "estoque" ? "#4FB8A6" : "#2C3138"}`,
              color: aba === "estoque" ? "#4FB8A6" : "#8A939D",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            ESTOQUE E VENDAS
          </button>
        </div>

        {aba === "estoque" && <Estoque />}

        {aba === "calculadora" && (
        <>
        <div className="grid-main">
          {/* FORM - estilo ticket de ordem de serviço */}
          <div
            style={{
              background: "#1E2228",
              border: "1px dashed #3A4048",
              borderRadius: 10,
              padding: 22,
              position: "relative",
            }}
          >
            <div
              className="mono"
              style={{ position: "absolute", top: -10, left: 20, background: "#14171A", padding: "0 8px", fontSize: 11, color: "#5A626B" }}
            >
              NOVA ORDEM
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 72,
                  height: 108,
                  borderRadius: 8,
                  background: "#14171A",
                  border: "1px solid #2C3138",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {fotoCarregando ? (
                  <span className="mono" style={{ fontSize: 9.5, color: "#5A626B", textAlign: "center", padding: "0 4px" }}>
                    buscando foto...
                  </span>
                ) : fotoUrl ? (
                  <img
                    src={fotoUrl}
                    alt={modelo}
                    onError={() => setFotoUrl(null)}
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }}
                  />
                ) : (
                  <IconeAparelho accent={marca ? marca.accent : "#4FB8A6"} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label>Marca e modelo do celular</label>
                <input
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="ex: iPhone 12, Galaxy A54, Redmi Note 12"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: marca ? marca.accent : "#5A626B" }}>
                  {marca ? `Marca detectada: ${marca.label}` : "Marca não identificada — usando ícone genérico"}
                  {fotoUrl && " · foto: Wikipédia"}
                </div>
              </div>
            </div>

            <div className="field">
              <label>Defeito do aparelho</label>
              <select value={defeito} onChange={(e) => setDefeito(e.target.value)}>
                {DEFEITOS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Valor de compra (R$)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={valorCompra}
                  onChange={(e) => setValorCompra(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="field">
                <label>Custo da peça (R$)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={custoPeca}
                  onChange={(e) => setCustoPeca(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Mão de obra (opcional — informativa, não entra no lucro)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={maoDeObra}
                  onChange={(e) => setMaoDeObra(e.target.value)}
                  placeholder="0,00 · é você quem faz"
                />
              </div>
              <div className="field">
                <label>Preço visto no mercado (opcional)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={precoMercado}
                  onChange={(e) => setPrecoMercado(e.target.value)}
                  placeholder="OLX / Mercado Livre"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Demanda do modelo</label>
                <select value={demandaManual} onChange={(e) => setDemandaManual(e.target.value)}>
                  <option value="">
                    {ref ? `Auto: ${ref.demanda}` : "Auto: Média (sem referência)"}
                  </option>
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>
              <div className="field">
                <label>Margem alvo (%) — só se não houver referência de venda</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={margemManual}
                  onChange={(e) => setMargemManual(e.target.value)}
                  placeholder={`sugerido: ${MARGEM_SUGERIDA[demanda]}%`}
                />
              </div>
            </div>

            {comparaveis.length > 0 && (
              <div
                style={{
                  background: "#14171A",
                  border: "1px solid #2C3138",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 11, color: "#5A626B", marginBottom: 6 }}>
                  Comparáveis em Jaraguá do Sul (OLX, coletado em {DATA_COLETA_REGIONAL})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {comparaveis.map((c, i) => (
                    <span
                      key={i}
                      className="mono"
                      style={{
                        fontSize: 11.5,
                        padding: "3px 8px",
                        borderRadius: 5,
                        background: "#1E2228",
                        border: "1px solid #2C3138",
                        color: "#8A939D",
                      }}
                    >
                      {c.modelo} · {moeda(c.preco)} {c.tipo === "loja" ? "(loja)" : ""}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: "#5A626B", marginTop: 6 }}>
                  Preços pedidos em anúncios ativos, não valores de fechamento. Podem incluir
                  variantes (Pro, Pro Max) do modelo digitado — confira antes de usar como base.
                </div>
              </div>
            )}

            <div className="field">
              <label>Margem mínima aceitável (%)</label>
              <input
                type="number"
                inputMode="decimal"
                value={margemMinima}
                onChange={(e) => setMargemMinima(e.target.value)}
                placeholder="padrão: 20%"
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                onClick={registrarOrdem}
                disabled={!modelo.trim() || custoDinheiro <= 0 || !supabaseConfigurado || salvando}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    !modelo.trim() || custoDinheiro <= 0 || !supabaseConfigurado || salvando
                      ? "#2C3138"
                      : "#4FB8A6",
                  color:
                    !modelo.trim() || custoDinheiro <= 0 || !supabaseConfigurado || salvando
                      ? "#5A626B"
                      : "#0D1210",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor:
                    !modelo.trim() || custoDinheiro <= 0 || !supabaseConfigurado || salvando
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {salvando ? "Salvando..." : "Registrar e calcular"}
              </button>
              <button
                type="button"
                onClick={limparForm}
                title="Limpa todos os campos do formulário, sem apagar o histórico"
                style={{
                  padding: "12px 16px",
                  borderRadius: 6,
                  border: "1px solid #2C3138",
                  background: "none",
                  color: "#8A939D",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Limpar campos
              </button>
            </div>
          </div>

          {/* RESULTADO */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {avaliacao && (
              <div
                style={{
                  background: "#1E2228",
                  border: `1px solid ${VEREDITO_INFO[avaliacao.nivel].cor}55`,
                  borderRadius: 10,
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span
                    className="display"
                    style={{ fontSize: 17, fontWeight: 700, color: VEREDITO_INFO[avaliacao.nivel].cor }}
                  >
                    {VEREDITO_INFO[avaliacao.nivel].label}
                  </span>
                  <span className="mono" style={{ fontSize: 12, color: "#8A939D" }}>
                    lucro {moeda(avaliacao.lucroAlvo)}
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#8A939D", lineHeight: 1.6 }}>
                  {avaliacao.motivos.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* PREÇOS DE VENDA SUGERIDOS */}
            <div
              style={{
                background: "#1E2228",
                border: "1px solid #2C3138",
                borderRadius: 10,
                padding: 22,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 11, color: "#5A626B" }}>
                  POR QUANTO VENDER (SEMINOVO CONSERTADO)
                </span>
              </div>

              {!origemVenda ? (
                <p style={{ fontSize: 13, color: "#8A939D", margin: "10px 0 0" }}>
                  Informe um modelo reconhecido ou preencha "Preço visto no mercado" para ver os
                  três valores de venda sugeridos.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 12.5, color: "#8A939D", margin: "0 0 16px" }}>
                    Baseado {ORIGEM_VENDA_LABEL[origemVenda]}. Lucro = venda − compra ({moeda(nCompra)})
                    − peça ({moeda(nPeca)}); mão de obra não entra, é seu trabalho.
                  </p>

                  <div className="grid-3">
                    {[
                      { key: "alta", label: "ALTO", venda: vendaAlta, cor: "#4FB8A6", sub: "topo da faixa de mercado" },
                      { key: "media", label: "MÉDIO", venda: vendaMedia, cor: "#4FB8A6", sub: "seu preço de anúncio", destaque: true },
                      { key: "baixa", label: "BAIXO", venda: vendaBaixa, cor: "#8A939D", sub: "para vender rápido" },
                    ].map((t) => {
                      const calc = lucroEVeredito(t.venda);
                      return (
                        <div
                          key={t.key}
                          style={{
                            background: "#14171A",
                            border: `1px solid ${t.destaque ? "#4FB8A655" : "#2C3138"}`,
                            borderRadius: 8,
                            padding: "12px 14px",
                          }}
                        >
                          <div style={{ fontSize: 10.5, color: t.destaque ? "#4FB8A6" : "#8A939D", letterSpacing: 0.02 }}>
                            {t.label}
                          </div>
                          <div
                            className={t.destaque ? "mono display" : "mono"}
                            style={{ fontSize: t.destaque ? 18 : 17, fontWeight: 700, margin: "4px 0", color: t.destaque ? "#4FB8A6" : "#EDEFF1" }}
                          >
                            {t.venda !== null ? moeda(t.venda) : "—"}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#5A626B", marginBottom: 8 }}>{t.sub}</div>
                          {calc && (
                            <div
                              className="mono"
                              style={{
                                fontSize: 11,
                                color: calc.veredito === "ruim" ? "#D9683D" : calc.veredito === "ressalva" ? "#D9A63D" : "#4FB8A6",
                                marginBottom: 8,
                              }}
                            >
                              lucro {moeda(calc.lucro)}
                              {calc.margemPct !== null ? ` (${Math.round(calc.margemPct)}%)` : ""}
                            </div>
                          )}
                          <button
                            onClick={() => usarPrecoVenda(t.venda)}
                            style={{
                              width: "100%",
                              background: t.destaque ? "#4FB8A6" : "none",
                              border: t.destaque ? "none" : "1px solid #2C3138",
                              color: t.destaque ? "#0D1210" : "#8A939D",
                              borderRadius: 6,
                              padding: "5px 8px",
                              fontSize: 11,
                              fontWeight: t.destaque ? 600 : 400,
                              cursor: "pointer",
                            }}
                          >
                            Usar
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {custoDinheiro > 0 && lucroEVeredito(vendaAlta)?.veredito === "ruim" && (
                    <div
                      style={{
                        background: "#D9683D22",
                        border: "1px solid #D9683D55",
                        color: "#D9683D",
                        borderRadius: 6,
                        padding: "10px 12px",
                        fontSize: 12.5,
                        marginTop: 12,
                      }}
                    >
                      Até no cenário de venda mais alta ({moeda(vendaAlta)}) o negócio pode não
                      cobrir compra + peça. Revise o valor de compra ou o custo da peça antes de
                      fechar.
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                background: "#1E2228",
                border: "1px solid #2C3138",
                borderRadius: 10,
                padding: 22,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span className="mono" style={{ fontSize: 11, color: "#5A626B" }}>
                  ESTIMATIVA
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: DEMANDA_INFO[demanda].cor + "22",
                    color: DEMANDA_INFO[demanda].cor,
                    border: `1px solid ${DEMANDA_INFO[demanda].cor}55`,
                  }}
                >
                  Demanda {demanda}
                </span>
              </div>

              <p style={{ fontSize: 13, color: "#8A939D", marginTop: 0, marginBottom: 18 }}>
                {DEMANDA_INFO[demanda].texto}
              </p>

              <div className="grid-3-18" style={{ marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: "#8A939D" }}>Ponto de equilíbrio</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{moeda(precoEquilibrio)}</div>
                  <div style={{ fontSize: 10.5, color: "#5A626B" }}>lucro zero</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: "#8A939D" }}>Preço mínimo</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{moeda(precoMinimo)}</div>
                  <div style={{ fontSize: 10.5, color: "#5A626B" }}>margem mín. {margemMinimaN}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: "#8A939D" }}>Preço sugerido</div>
                  <div className="mono display" style={{ fontSize: 16, fontWeight: 700, color: "#4FB8A6" }}>{moeda(precoSugerido)}</div>
                  <div style={{ fontSize: 10.5, color: "#5A626B" }}>
                    {origemVenda ? `venda ${ORIGEM_VENDA_LABEL[origemVenda]}` : `margem alvo ${margemAlvo}% (sem referência de mercado)`}
                  </div>
                </div>
              </div>

              <div className="grid-2-16" style={{ marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#8A939D" }}>Custo considerado no lucro (compra + peça)</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                    {moeda(custoDinheiro)}
                  </div>
                  {nMao > 0 && (
                    <div style={{ fontSize: 10.5, color: "#5A626B" }}>
                      + {moeda(nMao)} de mão de obra (seu trabalho, não entra no lucro)
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#8A939D" }}>Faixa de referência do modelo</div>
                  <div className="mono" style={{ fontSize: 15 }}>
                    {ref ? `${moeda(ref.faixa[0])} – ${moeda(ref.faixa[1])}` : "sem dado de referência"}
                  </div>
                </div>
              </div>

              {acimaDoMercado && (
                <div
                  style={{
                    background: "#D9683D22",
                    border: "1px solid #D9683D55",
                    color: "#D9683D",
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 13,
                    marginTop: 14,
                  }}
                >
                  O preço sugerido está acima do que você viu no mercado ({moeda(nMercado)}).
                  Considere reduzir a margem alvo ou revisar o custo de compra.
                </div>
              )}

              <div style={{ fontSize: 11, color: "#5A626B", marginTop: 16, lineHeight: 1.5 }}>
                Quando não há comparável de Jaraguá do Sul, a demanda, a margem e o preço de
                revenda usam a referência nacional (atualizada em {DATA_REFERENCIA_NACIONAL} a
                partir de Trocafone, Brused, TechTudo e TechLoad). Os comparáveis regionais vêm
                de anúncios ativos no OLX coletados em {DATA_COLETA_REGIONAL} — não é uma
                varredura ao vivo, não inclui Facebook Marketplace (exige login) nem Mercado Livre
                nesta versão, e preço pedido não é preço de venda nem de revenda seminovo (que
                varia com estado da bateria, tela e capacidade). Reconfirme antes de fechar negócio.
              </div>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1, background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 12, color: "#8A939D" }}>Total investido</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{moeda(totalInvestido)}</div>
              </div>
              <div style={{ flex: 1, background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 12, color: "#8A939D" }}>Lucro previsto total</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#4FB8A6" }}>{moeda(totalLucroPrevisto)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* HISTÓRICO */}
        <div style={{ marginTop: 32 }}>
          <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
            HISTÓRICO ({ordens.length})
          </div>

          {erroStorage && (
            <div style={{ color: "#D9683D", fontSize: 13, marginBottom: 12 }}>
              Não foi possível sincronizar com o banco agora. Verifique sua internet ou a
              configuração do Supabase e tente de novo.
            </div>
          )}

          {carregando ? (
            <div style={{ color: "#5A626B", fontSize: 13 }}>Carregando...</div>
          ) : ordens.length === 0 ? (
            <div
              style={{
                border: "1px dashed #2C3138",
                borderRadius: 10,
                padding: 28,
                textAlign: "center",
                color: "#5A626B",
                fontSize: 13,
              }}
            >
              Nenhuma ordem registrada ainda. Preencha o formulário acima para começar.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="history-head">
                <span>Modelo</span>
                <span>Custo</span>
                <span>Venda</span>
                <span>Lucro</span>
                <span>Status</span>
                <span></span>
              </div>
              {ordens.map((o) => (
                <div
                  key={o.id}
                  className="history-row"
                  style={{
                    background: "#1E2228",
                    border: "1px solid #2C3138",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {o.fotoUrl && (
                      <img
                        src={o.fotoUrl}
                        alt={o.modelo}
                        style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 4, background: "#14171A", flexShrink: 0 }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 600 }}>{o.modelo}</div>
                      <div style={{ color: "#8A939D", fontSize: 12 }}>{o.marca ? `${o.marca} · ` : ""}{o.defeito}</div>
                    </div>
                  </div>
                  <div>
                    <span className="history-tag">Custo</span>
                    <span className="mono">{moeda(o.custoDinheiro)}</span>
                  </div>
                  <div>
                    <span className="history-tag">Venda</span>
                    <span className="mono" style={{ color: "#4FB8A6" }}>{moeda(o.precoSugerido)}</span>
                  </div>
                  <div>
                    <span className="history-tag">Lucro</span>
                    <span className="mono">{moeda(o.lucroAlvo)}</span>
                  </div>
                  <div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: (o.veredito ? VEREDITO_INFO[o.veredito].cor : "#5A626B") + "22",
                        color: o.veredito ? VEREDITO_INFO[o.veredito].cor : "#5A626B",
                      }}
                    >
                      {o.veredito ? VEREDITO_INFO[o.veredito].label : o.demanda}
                    </span>
                  </div>
                  <button
                    onClick={() => removerOrdem(o.id)}
                    style={{
                      background: "none",
                      border: "1px solid #2C3138",
                      color: "#8A939D",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
