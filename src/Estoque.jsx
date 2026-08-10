import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

const TABELA_APARELHOS = "estoque_aparelhos";
const TABELA_PECAS = "estoque_pecas";
const TABELA_SERVICOS = "estoque_servicos";

function moeda(v) {
  if (isNaN(v)) return "R$ 0,00";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function dataBR(d) {
  if (!d) return "—";
  const [ano, mes, dia] = d.split("-");
  return `${dia}/${mes}/${ano}`;
}

function mesLabel(d) {
  const [ano, mes] = d.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`;
}

const NOMES_MES_COMPLETO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function ymd(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function ultimoDiaMes(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

// Calcula a data de início e fim (inclusive) do período escolhido no filtro.
function intervaloPeriodo(filtro, mesPersonalizado) {
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

function labelPeriodo(filtro, mesPersonalizado) {
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
function linhaParaAparelho(l) {
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

function linhaParaPeca(l) {
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

function linhaParaServico(l) {
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
  };
}

export default function Estoque() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [aparelhos, setAparelhos] = useState([]);
  const [pecas, setPecas] = useState([]);
  const [servicos, setServicos] = useState([]);

  // form: novo aparelho
  const [modelo, setModelo] = useState("");
  const [marca, setMarca] = useState("");
  const [dataEntrada, setDataEntrada] = useState(hoje());
  const [valorCompra, setValorCompra] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvandoAparelho, setSalvandoAparelho] = useState(false);

  // form: nova peça
  const [nomePeca, setNomePeca] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valorPeca, setValorPeca] = useState("");
  const [dataCompraPeca, setDataCompraPeca] = useState(hoje());
  const [vinculoPeca, setVinculoPeca] = useState(""); // "" | "aparelho:ID" | "servico:ID"
  const [salvandoPeca, setSalvandoPeca] = useState(false);

  // form: registrar venda (inline, por aparelho)
  const [vendaAbertaId, setVendaAbertaId] = useState(null);
  const [dataSaida, setDataSaida] = useState(hoje());
  const [valorVenda, setValorVenda] = useState("");
  const [comprador, setComprador] = useState("");
  const [salvandoVenda, setSalvandoVenda] = useState(false);

  // form: novo serviço de reparo (aparelho de cliente)
  const [clienteServico, setClienteServico] = useState("");
  const [aparelhoServico, setAparelhoServico] = useState("");
  const [defeitoServico, setDefeitoServico] = useState("");
  const [dataEntradaServico, setDataEntradaServico] = useState(hoje());
  const [valorCobradoServico, setValorCobradoServico] = useState("");
  const [observacaoServico, setObservacaoServico] = useState("");
  const [salvandoServico, setSalvandoServico] = useState(false);

  // form: concluir serviço (inline, por serviço)
  const [conclusaoAbertaId, setConclusaoAbertaId] = useState(null);
  const [dataConclusao, setDataConclusao] = useState(hoje());
  const [valorCobradoFinal, setValorCobradoFinal] = useState("");
  const [salvandoConclusao, setSalvandoConclusao] = useState(false);

  // filtro de período do dashboard (histórico de vendas e serviços)
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes_atual");
  const [mesPersonalizado, setMesPersonalizado] = useState(hoje().slice(0, 7));

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const [rAparelhos, rPecas, rServicos] = await Promise.all([
        supabase.from(TABELA_APARELHOS).select("*").order("criado_em", { ascending: false }),
        supabase.from(TABELA_PECAS).select("*").order("criado_em", { ascending: false }),
        supabase.from(TABELA_SERVICOS).select("*").order("criado_em", { ascending: false }),
      ]);
      if (!ativo) return;
      if (rAparelhos.error || rPecas.error || rServicos.error) {
        setErro(true);
      } else {
        setAparelhos(rAparelhos.data.map(linhaParaAparelho));
        setPecas(rPecas.data.map(linhaParaPeca));
        setServicos(rServicos.data.map(linhaParaServico));
        setErro(false);
      }
      setCarregando(false);
    }
    carregar();

    const canal = supabase
      .channel("estoque-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: TABELA_APARELHOS }, (payload) => {
        if (payload.eventType === "INSERT") {
          const novo = linhaParaAparelho(payload.new);
          setAparelhos((atual) => (atual.some((a) => a.id === novo.id) ? atual : [novo, ...atual]));
        } else if (payload.eventType === "DELETE") {
          setAparelhos((atual) => atual.filter((a) => a.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          const atualizado = linhaParaAparelho(payload.new);
          setAparelhos((atual) => atual.map((a) => (a.id === atualizado.id ? atualizado : a)));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: TABELA_PECAS }, (payload) => {
        if (payload.eventType === "INSERT") {
          const nova = linhaParaPeca(payload.new);
          setPecas((atual) => (atual.some((p) => p.id === nova.id) ? atual : [nova, ...atual]));
        } else if (payload.eventType === "DELETE") {
          setPecas((atual) => atual.filter((p) => p.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          const atualizada = linhaParaPeca(payload.new);
          setPecas((atual) => atual.map((p) => (p.id === atualizada.id ? atualizada : p)));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: TABELA_SERVICOS }, (payload) => {
        if (payload.eventType === "INSERT") {
          const novo = linhaParaServico(payload.new);
          setServicos((atual) => (atual.some((s) => s.id === novo.id) ? atual : [novo, ...atual]));
        } else if (payload.eventType === "DELETE") {
          setServicos((atual) => atual.filter((s) => s.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          const atualizado = linhaParaServico(payload.new);
          setServicos((atual) => atual.map((s) => (s.id === atualizado.id ? atualizado : s)));
        }
      })
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  function pecasDoAparelho(aparelhoId) {
    return pecas.filter((p) => p.aparelhoId === aparelhoId);
  }

  function pecasDoServico(servicoId) {
    return pecas.filter((p) => p.servicoId === servicoId);
  }

  function custoTotalAparelho(aparelho) {
    const somaPecas = pecasDoAparelho(aparelho.id).reduce((s, p) => s + p.valor, 0);
    return aparelho.valorCompra + somaPecas;
  }

  function custoPecasServico(servico) {
    return pecasDoServico(servico.id).reduce((s, p) => s + p.valor, 0);
  }

  function lucroServico(servico) {
    if (servico.valorCobrado === null || servico.valorCobrado === undefined) return null;
    return servico.valorCobrado - custoPecasServico(servico);
  }

  const emEstoque = useMemo(
    () => aparelhos.filter((a) => a.status !== "vendido").sort((a, b) => (b.dataEntrada || "").localeCompare(a.dataEntrada || "")),
    [aparelhos]
  );
  const vendidos = useMemo(
    () => aparelhos.filter((a) => a.status === "vendido").sort((a, b) => (b.dataSaida || "").localeCompare(a.dataSaida || "")),
    [aparelhos]
  );

  const totalInvestidoEstoque = emEstoque.reduce((s, a) => s + custoTotalAparelho(a), 0);

  const servicosEmAndamento = useMemo(
    () => servicos.filter((s) => s.status !== "concluido").sort((a, b) => (b.dataEntrada || "").localeCompare(a.dataEntrada || "")),
    [servicos]
  );
  const servicosConcluidos = useMemo(
    () => servicos.filter((s) => s.status === "concluido").sort((a, b) => (b.dataConclusao || "").localeCompare(a.dataConclusao || "")),
    [servicos]
  );
  const totalAReceberServicos = servicosEmAndamento.reduce((s, srv) => s + (srv.valorCobrado || 0), 0);

  // ---------- Filtro de período (afeta resumo financeiro e históricos) ----------
  const { inicio: inicioPeriodo, fim: fimPeriodo } = useMemo(
    () => intervaloPeriodo(filtroPeriodo, mesPersonalizado),
    [filtroPeriodo, mesPersonalizado]
  );

  const vendidosPeriodo = useMemo(
    () => vendidos.filter((a) => a.dataSaida && a.dataSaida >= inicioPeriodo && a.dataSaida <= fimPeriodo),
    [vendidos, inicioPeriodo, fimPeriodo]
  );
  const servicosConcluidosPeriodo = useMemo(
    () => servicosConcluidos.filter((s) => s.dataConclusao && s.dataConclusao >= inicioPeriodo && s.dataConclusao <= fimPeriodo),
    [servicosConcluidos, inicioPeriodo, fimPeriodo]
  );

  const totalLucroVendas = vendidosPeriodo.reduce((s, a) => s + (a.valorVenda - custoTotalAparelho(a)), 0);
  const totalVendidoValor = vendidosPeriodo.reduce((s, a) => s + (a.valorVenda || 0), 0);
  const totalLucroServicos = servicosConcluidosPeriodo.reduce((s, srv) => s + (lucroServico(srv) || 0), 0);

  // ---------- Vendas agrupadas por mês, para o gráfico (sempre mostra tudo, não filtra por período) ----------
  const vendasPorMes = useMemo(() => {
    const mapa = new Map();
    for (const a of vendidos) {
      if (!a.dataSaida) continue;
      const chave = a.dataSaida.slice(0, 7); // "AAAA-MM"
      const atual = mapa.get(chave) || { chave, total: 0, lucro: 0, qtd: 0 };
      atual.total += a.valorVenda || 0;
      atual.lucro += (a.valorVenda || 0) - custoTotalAparelho(a);
      atual.qtd += 1;
      mapa.set(chave, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  }, [vendidos, pecas]);

  async function adicionarAparelho() {
    if (!modelo.trim() || Number(valorCompra) <= 0) return;
    setSalvandoAparelho(true);
    const { error } = await supabase.from(TABELA_APARELHOS).insert({
      modelo: modelo.trim(),
      marca: marca.trim() || null,
      data_entrada: dataEntrada,
      valor_compra: Number(valorCompra) || 0,
      observacao: observacao.trim() || null,
      status: "em_estoque",
    });
    setSalvandoAparelho(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setModelo("");
    setMarca("");
    setValorCompra("");
    setObservacao("");
    setDataEntrada(hoje());
  }

  async function adicionarPeca() {
    if (!nomePeca.trim() || Number(valorPeca) <= 0) return;
    const [tipo, id] = vinculoPeca ? vinculoPeca.split(":") : [null, null];
    setSalvandoPeca(true);
    const { error } = await supabase.from(TABELA_PECAS).insert({
      aparelho_id: tipo === "aparelho" ? id : null,
      servico_id: tipo === "servico" ? id : null,
      nome_peca: nomePeca.trim(),
      fornecedor: fornecedor.trim() || null,
      valor: Number(valorPeca) || 0,
      data_compra: dataCompraPeca,
    });
    setSalvandoPeca(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setNomePeca("");
    setFornecedor("");
    setValorPeca("");
    setVinculoPeca("");
    setDataCompraPeca(hoje());
  }

  async function adicionarServico() {
    if (!clienteServico.trim() || !aparelhoServico.trim()) return;
    setSalvandoServico(true);
    const { error } = await supabase.from(TABELA_SERVICOS).insert({
      cliente: clienteServico.trim(),
      aparelho: aparelhoServico.trim(),
      defeito: defeitoServico.trim() || null,
      data_entrada: dataEntradaServico,
      valor_cobrado: valorCobradoServico !== "" ? Number(valorCobradoServico) : null,
      observacao: observacaoServico.trim() || null,
      status: "em_andamento",
    });
    setSalvandoServico(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setClienteServico("");
    setAparelhoServico("");
    setDefeitoServico("");
    setValorCobradoServico("");
    setObservacaoServico("");
    setDataEntradaServico(hoje());
  }

  function abrirConclusao(servico) {
    setConclusaoAbertaId(servico.id);
    setDataConclusao(hoje());
    setValorCobradoFinal(servico.valorCobrado !== null ? String(servico.valorCobrado) : "");
  }

  async function confirmarConclusao(id) {
    if (Number(valorCobradoFinal) <= 0) return;
    setSalvandoConclusao(true);
    const { error } = await supabase
      .from(TABELA_SERVICOS)
      .update({
        status: "concluido",
        data_conclusao: dataConclusao,
        valor_cobrado: Number(valorCobradoFinal) || 0,
      })
      .eq("id", id);
    setSalvandoConclusao(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setConclusaoAbertaId(null);
  }

  async function removerServico(id) {
    const { error } = await supabase.from(TABELA_SERVICOS).delete().eq("id", id);
    if (error) setErro(true);
  }

  function abrirVenda(id) {
    setVendaAbertaId(id);
    setDataSaida(hoje());
    setValorVenda("");
    setComprador("");
  }

  async function confirmarVenda(id) {
    if (Number(valorVenda) <= 0) return;
    setSalvandoVenda(true);
    const { error } = await supabase
      .from(TABELA_APARELHOS)
      .update({
        status: "vendido",
        data_saida: dataSaida,
        valor_venda: Number(valorVenda) || 0,
        comprador: comprador.trim() || null,
      })
      .eq("id", id);
    setSalvandoVenda(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setVendaAbertaId(null);
  }

  async function removerAparelho(id) {
    const { error } = await supabase.from(TABELA_APARELHOS).delete().eq("id", id);
    if (error) setErro(true);
  }

  async function removerPeca(id) {
    const { error } = await supabase.from(TABELA_PECAS).delete().eq("id", id);
    if (error) setErro(true);
  }

  const maxMes = Math.max(1, ...vendasPorMes.map((m) => m.total));

  if (carregando) {
    return <div style={{ color: "#5A626B", fontSize: 13 }}>Carregando estoque...</div>;
  }

  return (
    <div>
      {erro && (
        <div style={{ color: "#D9683D", fontSize: 13, marginBottom: 16 }}>
          Não foi possível sincronizar com o banco agora. Verifique sua internet ou a
          configuração do Supabase e tente de novo.
        </div>
      )}

      {/* FILTRO DE PERÍODO */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <span className="mono" style={{ fontSize: 11, color: "#5A626B", marginRight: 4 }}>PERÍODO:</span>
        {[
          { valor: "mes_atual", rotulo: "Este mês" },
          { valor: "mes_passado", rotulo: "Mês passado" },
          { valor: "3meses", rotulo: "Últimos 3 meses" },
          { valor: "ano_atual", rotulo: "Este ano" },
          { valor: "tudo", rotulo: "Tudo" },
          { valor: "personalizado", rotulo: "Escolher mês" },
        ].map((op) => (
          <button
            key={op.valor}
            onClick={() => setFiltroPeriodo(op.valor)}
            className="mono"
            style={{
              background: filtroPeriodo === op.valor ? "#4FB8A622" : "transparent",
              border: `1px solid ${filtroPeriodo === op.valor ? "#4FB8A6" : "#2C3138"}`,
              color: filtroPeriodo === op.valor ? "#4FB8A6" : "#8A939D",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {op.rotulo}
          </button>
        ))}
        {filtroPeriodo === "personalizado" && (
          <input
            type="month"
            value={mesPersonalizado}
            onChange={(e) => setMesPersonalizado(e.target.value)}
            style={{
              background: "#1E2228",
              border: "1px solid #2C3138",
              color: "#E4E7EB",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12.5,
            }}
          />
        )}
      </div>

      {/* RESUMO */}
      <div className="grid-3-18" style={{ marginBottom: 8 }}>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Em estoque agora</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{emEstoque.length} aparelho{emEstoque.length === 1 ? "" : "s"}</div>
          <div style={{ fontSize: 12, color: "#5A626B", marginTop: 2 }}>{moeda(totalInvestidoEstoque)} investidos</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Vendidos</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{vendidosPeriodo.length}</div>
          <div style={{ fontSize: 12, color: "#5A626B", marginTop: 2 }}>{moeda(totalVendidoValor)} em vendas</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Lucro em vendas</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#4FB8A6" }}>{moeda(totalLucroVendas)}</div>
          <div style={{ fontSize: 12, color: "#5A626B", marginTop: 2 }}>compra + peças já descontados</div>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 28 }}>
        valores de vendas/serviços acima referentes a: {labelPeriodo(filtroPeriodo, mesPersonalizado)}
      </div>

      <div className="grid-2-16" style={{ marginBottom: 28 }}>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Serviços em andamento</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{servicosEmAndamento.length}</div>
          <div style={{ fontSize: 12, color: "#5A626B", marginTop: 2 }}>{moeda(totalAReceberServicos)} a receber</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Lucro em serviços concluídos</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#4FB8A6" }}>{moeda(totalLucroServicos)}</div>
          <div style={{ fontSize: 12, color: "#5A626B", marginTop: 2 }}>{servicosConcluidosPeriodo.length} concluído{servicosConcluidosPeriodo.length === 1 ? "" : "s"} no período · valor cobrado − peças</div>
        </div>
      </div>

      <div className="grid-main">
        {/* FORMULÁRIOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#1E2228", border: "1px dashed #3A4048", borderRadius: 10, padding: 22, position: "relative" }}>
            <div className="mono" style={{ position: "absolute", top: -10, left: 20, background: "#14171A", padding: "0 8px", fontSize: 11, color: "#5A626B" }}>
              ENTRADA DE APARELHO
            </div>
            <div className="field">
              <label>Modelo</label>
              <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex: iPhone 12 64GB" />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Marca (opcional)</label>
                <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex: Apple" />
              </div>
              <div className="field">
                <label>Data da compra</label>
                <input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Valor pago no aparelho</label>
                <input type="number" inputMode="decimal" value={valorCompra} onChange={(e) => setValorCompra(e.target.value)} placeholder="0,00" />
              </div>
              <div className="field">
                <label>Observação (opcional)</label>
                <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: tela quebrada" />
              </div>
            </div>
            <button
              onClick={adicionarAparelho}
              disabled={salvandoAparelho || !modelo.trim() || Number(valorCompra) <= 0}
              className="mono"
              style={{
                width: "100%",
                marginTop: 6,
                background: "#4FB8A6",
                color: "#14171A",
                border: "none",
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: salvandoAparelho || !modelo.trim() || Number(valorCompra) <= 0 ? 0.5 : 1,
              }}
            >
              {salvandoAparelho ? "Salvando..." : "Registrar entrada"}
            </button>
          </div>

          <div style={{ background: "#1E2228", border: "1px dashed #3A4048", borderRadius: 10, padding: 22, position: "relative" }}>
            <div className="mono" style={{ position: "absolute", top: -10, left: 20, background: "#14171A", padding: "0 8px", fontSize: 11, color: "#5A626B" }}>
              NOVO SERVIÇO DE REPARO
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Cliente</label>
                <input value={clienteServico} onChange={(e) => setClienteServico(e.target.value)} placeholder="Nome do cliente" />
              </div>
              <div className="field">
                <label>Aparelho</label>
                <input value={aparelhoServico} onChange={(e) => setAparelhoServico(e.target.value)} placeholder="Ex: Moto G54" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Defeito relatado (opcional)</label>
                <input value={defeitoServico} onChange={(e) => setDefeitoServico(e.target.value)} placeholder="Ex: não liga" />
              </div>
              <div className="field">
                <label>Data de entrada</label>
                <input type="date" value={dataEntradaServico} onChange={(e) => setDataEntradaServico(e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Valor a cobrar (opcional, pode informar na conclusão)</label>
                <input type="number" inputMode="decimal" value={valorCobradoServico} onChange={(e) => setValorCobradoServico(e.target.value)} placeholder="0,00" />
              </div>
              <div className="field">
                <label>Observação (opcional)</label>
                <input value={observacaoServico} onChange={(e) => setObservacaoServico(e.target.value)} placeholder="Ex: orçamento aprovado" />
              </div>
            </div>
            <button
              onClick={adicionarServico}
              disabled={salvandoServico || !clienteServico.trim() || !aparelhoServico.trim()}
              className="mono"
              style={{
                width: "100%",
                marginTop: 6,
                background: "#4FB8A6",
                color: "#14171A",
                border: "none",
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: salvandoServico || !clienteServico.trim() || !aparelhoServico.trim() ? 0.5 : 1,
              }}
            >
              {salvandoServico ? "Salvando..." : "Registrar serviço"}
            </button>
          </div>

          <div style={{ background: "#1E2228", border: "1px dashed #3A4048", borderRadius: 10, padding: 22, position: "relative" }}>
            <div className="mono" style={{ position: "absolute", top: -10, left: 20, background: "#14171A", padding: "0 8px", fontSize: 11, color: "#5A626B" }}>
              COMPRA DE PEÇA
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Peça</label>
                <input value={nomePeca} onChange={(e) => setNomePeca(e.target.value)} placeholder="Ex: Tela iPhone 12" />
              </div>
              <div className="field">
                <label>Fornecedor (opcional)</label>
                <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex: Loja XYZ" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Valor</label>
                <input type="number" inputMode="decimal" value={valorPeca} onChange={(e) => setValorPeca(e.target.value)} placeholder="0,00" />
              </div>
              <div className="field">
                <label>Data da compra</label>
                <input type="date" value={dataCompraPeca} onChange={(e) => setDataCompraPeca(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Vincular a (opcional)</label>
              <select value={vinculoPeca} onChange={(e) => setVinculoPeca(e.target.value)}>
                <option value="">Nenhum / estoque de peças avulso</option>
                <optgroup label="Aparelhos do estoque (revenda)">
                  {aparelhos.map((a) => (
                    <option key={`aparelho:${a.id}`} value={`aparelho:${a.id}`}>
                      {a.modelo} — entrada {dataBR(a.dataEntrada)}{a.status === "vendido" ? " (vendido)" : ""}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Serviços de reparo (cliente)">
                  {servicos.map((s) => (
                    <option key={`servico:${s.id}`} value={`servico:${s.id}`}>
                      {s.cliente} — {s.aparelho}{s.status === "concluido" ? " (concluído)" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <button
              onClick={adicionarPeca}
              disabled={salvandoPeca || !nomePeca.trim() || Number(valorPeca) <= 0}
              className="mono"
              style={{
                width: "100%",
                marginTop: 6,
                background: "transparent",
                color: "#4FB8A6",
                border: "1px solid #4FB8A6",
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: salvandoPeca || !nomePeca.trim() || Number(valorPeca) <= 0 ? 0.5 : 1,
              }}
            >
              {salvandoPeca ? "Salvando..." : "Registrar compra de peça"}
            </button>
          </div>
        </div>

        {/* EM ESTOQUE */}
        <div>
          <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
            EM ESTOQUE ({emEstoque.length})
          </div>
          {emEstoque.length === 0 ? (
            <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
              Nenhum aparelho em estoque no momento.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {emEstoque.map((a) => {
                const pecasVinc = pecasDoAparelho(a.id);
                const custo = custoTotalAparelho(a);
                return (
                  <div key={a.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{a.modelo}</div>
                        <div style={{ color: "#8A939D", fontSize: 12 }}>
                          {a.marca ? `${a.marca} · ` : ""}entrada {dataBR(a.dataEntrada)}
                          {a.observacao ? ` · ${a.observacao}` : ""}
                        </div>
                        {pecasVinc.length > 0 && (
                          <div style={{ color: "#5A626B", fontSize: 11.5, marginTop: 4 }}>
                            {pecasVinc.length} peça{pecasVinc.length > 1 ? "s" : ""}: {pecasVinc.map((p) => p.nomePeca).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: 14, textAlign: "right", whiteSpace: "nowrap" }}>
                        {moeda(custo)}
                        <div style={{ fontSize: 10.5, color: "#5A626B", fontWeight: 400 }}>custo total</div>
                      </div>
                    </div>

                    {vendaAbertaId === a.id ? (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #2C3138" }}>
                        <div className="grid-3">
                          <div className="field" style={{ marginBottom: 8 }}>
                            <label>Data da venda</label>
                            <input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} />
                          </div>
                          <div className="field" style={{ marginBottom: 8 }}>
                            <label>Valor da venda</label>
                            <input type="number" inputMode="decimal" value={valorVenda} onChange={(e) => setValorVenda(e.target.value)} placeholder="0,00" />
                          </div>
                          <div className="field" style={{ marginBottom: 8 }}>
                            <label>Comprador (opcional)</label>
                            <input value={comprador} onChange={(e) => setComprador(e.target.value)} placeholder="Nome" />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => confirmarVenda(a.id)}
                            disabled={salvandoVenda || Number(valorVenda) <= 0}
                            className="mono"
                            style={{
                              background: "#4FB8A6",
                              color: "#14171A",
                              border: "none",
                              borderRadius: 6,
                              padding: "8px 14px",
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              opacity: salvandoVenda || Number(valorVenda) <= 0 ? 0.5 : 1,
                            }}
                          >
                            {salvandoVenda ? "Salvando..." : "Confirmar venda"}
                          </button>
                          <button
                            onClick={() => setVendaAbertaId(null)}
                            style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => abrirVenda(a.id)}
                          className="mono"
                          style={{ background: "transparent", color: "#4FB8A6", border: "1px solid #4FB8A6", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                        >
                          Registrar venda
                        </button>
                        <button
                          onClick={() => removerAparelho(a.id)}
                          style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SERVIÇOS DE REPARO EM ANDAMENTO */}
      <div style={{ marginTop: 32 }}>
        <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
          SERVIÇOS EM ANDAMENTO ({servicosEmAndamento.length})
        </div>
        {servicosEmAndamento.length === 0 ? (
          <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
            Nenhum serviço em andamento no momento.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {servicosEmAndamento.map((s) => {
              const pecasVinc = pecasDoServico(s.id);
              const custoPecas = custoPecasServico(s);
              return (
                <div key={s.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.aparelho} <span style={{ color: "#8A939D", fontWeight: 400 }}>· {s.cliente}</span></div>
                      <div style={{ color: "#8A939D", fontSize: 12 }}>
                        entrada {dataBR(s.dataEntrada)}{s.defeito ? ` · ${s.defeito}` : ""}{s.observacao ? ` · ${s.observacao}` : ""}
                      </div>
                      {pecasVinc.length > 0 && (
                        <div style={{ color: "#5A626B", fontSize: 11.5, marginTop: 4 }}>
                          {pecasVinc.length} peça{pecasVinc.length > 1 ? "s" : ""} ({moeda(custoPecas)}): {pecasVinc.map((p) => p.nomePeca).join(", ")}
                        </div>
                      )}
                    </div>
                    {s.valorCobrado !== null && (
                      <div className="mono" style={{ fontSize: 14, textAlign: "right", whiteSpace: "nowrap" }}>
                        {moeda(s.valorCobrado)}
                        <div style={{ fontSize: 10.5, color: "#5A626B", fontWeight: 400 }}>a cobrar</div>
                      </div>
                    )}
                  </div>

                  {conclusaoAbertaId === s.id ? (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #2C3138" }}>
                      <div className="grid-2">
                        <div className="field" style={{ marginBottom: 8 }}>
                          <label>Data de conclusão</label>
                          <input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
                        </div>
                        <div className="field" style={{ marginBottom: 8 }}>
                          <label>Valor cobrado</label>
                          <input type="number" inputMode="decimal" value={valorCobradoFinal} onChange={(e) => setValorCobradoFinal(e.target.value)} placeholder="0,00" />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => confirmarConclusao(s.id)}
                          disabled={salvandoConclusao || Number(valorCobradoFinal) <= 0}
                          className="mono"
                          style={{
                            background: "#4FB8A6",
                            color: "#14171A",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 14px",
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: salvandoConclusao || Number(valorCobradoFinal) <= 0 ? 0.5 : 1,
                          }}
                        >
                          {salvandoConclusao ? "Salvando..." : "Confirmar conclusão"}
                        </button>
                        <button
                          onClick={() => setConclusaoAbertaId(null)}
                          style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => abrirConclusao(s)}
                        className="mono"
                        style={{ background: "transparent", color: "#4FB8A6", border: "1px solid #4FB8A6", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                      >
                        Marcar concluído
                      </button>
                      <button
                        onClick={() => removerServico(s.id)}
                        style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HISTÓRICO DE SERVIÇOS CONCLUÍDOS */}
      <div style={{ marginTop: 32 }}>
        <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
          HISTÓRICO DE SERVIÇOS ({servicosConcluidosPeriodo.length}) — {labelPeriodo(filtroPeriodo, mesPersonalizado)}
        </div>
        {servicosConcluidosPeriodo.length === 0 ? (
          <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
            Nenhum serviço concluído em {labelPeriodo(filtroPeriodo, mesPersonalizado)}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {servicosConcluidosPeriodo.map((s) => {
              const custoPecas = custoPecasServico(s);
              const lucro = lucroServico(s) || 0;
              return (
                <div key={s.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.aparelho} <span style={{ color: "#8A939D", fontWeight: 400 }}>· {s.cliente}</span></div>
                    <div style={{ color: "#8A939D", fontSize: 12 }}>
                      entrada {dataBR(s.dataEntrada)} · concluído {dataBR(s.dataConclusao)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10.5, color: "#5A626B" }}>Peças</div>
                      <div className="mono" style={{ fontSize: 13 }}>{moeda(custoPecas)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10.5, color: "#5A626B" }}>Cobrado</div>
                      <div className="mono" style={{ fontSize: 13 }}>{moeda(s.valorCobrado)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10.5, color: "#5A626B" }}>Lucro</div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: lucro >= 0 ? "#4FB8A6" : "#D9683D" }}>{moeda(lucro)}</div>
                    </div>
                    <button
                      onClick={() => removerServico(s.id)}
                      style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* GRÁFICO DE VENDAS */}
      <div style={{ marginTop: 32 }}>
        <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
          VENDAS AO LONGO DO TEMPO <span style={{ color: "#3A4048" }}>(histórico completo, não segue o filtro de período)</span>
        </div>
        {vendasPorMes.length === 0 ? (
          <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "20px 18px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 160, overflowX: "auto" }}>
              {vendasPorMes.map((m) => {
                const alturaBarra = Math.max(4, (m.total / maxMes) * 130);
                return (
                  <div key={m.chave} style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 52 }}>
                    <div className="mono" style={{ fontSize: 10.5, color: "#4FB8A6", marginBottom: 4 }}>
                      {moeda(m.total).replace("R$", "").trim()}
                    </div>
                    <div
                      title={`${m.qtd} venda(s) · lucro ${moeda(m.lucro)}`}
                      style={{ width: 30, height: alturaBarra, background: "#4FB8A6", borderRadius: "4px 4px 0 0" }}
                    />
                    <div className="mono" style={{ fontSize: 10.5, color: "#8A939D", marginTop: 6 }}>{mesLabel(m.chave)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* HISTÓRICO DE VENDAS */}
      <div style={{ marginTop: 32 }}>
        <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
          HISTÓRICO DE VENDAS ({vendidosPeriodo.length}) — {labelPeriodo(filtroPeriodo, mesPersonalizado)}
        </div>
        {vendidosPeriodo.length === 0 ? (
          <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
            Nenhuma venda registrada em {labelPeriodo(filtroPeriodo, mesPersonalizado)}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vendidosPeriodo.map((a) => {
              const custo = custoTotalAparelho(a);
              const lucro = (a.valorVenda || 0) - custo;
              return (
                <div key={a.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.modelo}</div>
                    <div style={{ color: "#8A939D", fontSize: 12 }}>
                      comprado {dataBR(a.dataEntrada)} · vendido {dataBR(a.dataSaida)}{a.comprador ? ` · ${a.comprador}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10.5, color: "#5A626B" }}>Custo</div>
                      <div className="mono" style={{ fontSize: 13 }}>{moeda(custo)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10.5, color: "#5A626B" }}>Venda</div>
                      <div className="mono" style={{ fontSize: 13 }}>{moeda(a.valorVenda)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10.5, color: "#5A626B" }}>Lucro</div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: lucro >= 0 ? "#4FB8A6" : "#D9683D" }}>{moeda(lucro)}</div>
                    </div>
                    <button
                      onClick={() => removerAparelho(a.id)}
                      style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PEÇAS AVULSAS (não vinculadas a nenhum aparelho) */}
      {pecas.some((p) => !p.aparelhoId && !p.servicoId) && (
        <div style={{ marginTop: 32 }}>
          <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
            PEÇAS SEM VÍNCULO
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pecas.filter((p) => !p.aparelhoId && !p.servicoId).map((p) => (
              <div key={p.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{p.nomePeca}</span>
                  <span style={{ color: "#8A939D" }}> · {dataBR(p.dataCompra)}{p.fornecedor ? ` · ${p.fornecedor}` : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <span className="mono">{moeda(p.valor)}</span>
                  <button
                    onClick={() => removerPeca(p.id)}
                    style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, cursor: "pointer" }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
