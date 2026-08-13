import { useState, useMemo } from "react";
import { useEstoqueData } from "./useEstoqueData";
import { moeda, categoriasPorGranularidade, chaveData, rotuloCategoria, ETAPAS_CONCLUIDAS } from "./estoqueHelpers";

const COR_VENDAS = "#4FB8A6";
const COR_SERVICOS = "#D9A63D";

// Gráfico de linha em SVG puro (sem biblioteca externa), com 1 ou 2 séries
// desenhadas sobre o mesmo eixo X (as "categorias" — dias, meses ou anos).
function GraficoLinha({ categorias, granularidade, series }) {
  const largura = Math.max(520, categorias.length * (granularidade === "dia" ? 26 : 56));
  const altura = 200;
  const padEsq = 54, padDir = 16, padTopo = 16, padBaixo = 26;
  const areaW = largura - padEsq - padDir;
  const areaH = altura - padTopo - padBaixo;

  const maxValor = Math.max(1, ...series.flatMap((s) => s.valores));
  const x = (i) => padEsq + (categorias.length <= 1 ? areaW / 2 : (i / (categorias.length - 1)) * areaW);
  const y = (v) => padTopo + areaH - (v / maxValor) * areaH;

  const passoRotulo = Math.max(1, Math.ceil(categorias.length / 12));

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={largura} height={altura} style={{ display: "block" }}>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padEsq} x2={largura - padDir}
            y1={padTopo + areaH * (1 - f)} y2={padTopo + areaH * (1 - f)}
            stroke="#2C3138" strokeWidth="1"
          />
        ))}
        {[0, 0.5, 1].map((f) => (
          <text
            key={f}
            x={padEsq - 8} y={padTopo + areaH * (1 - f) + 3}
            fontSize="9.5" fill="#5A626B" textAnchor="end" fontFamily="'JetBrains Mono', monospace"
          >
            {moeda(maxValor * f).replace("R$", "").trim()}
          </text>
        ))}

        {series.map((s) => (
          <g key={s.nome}>
            <polyline
              points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none" stroke={s.cor} strokeWidth="2"
            />
            {s.valores.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={s.cor}>
                <title>{`${rotuloCategoria(categorias[i], granularidade)}: ${moeda(v)}`}</title>
              </circle>
            ))}
          </g>
        ))}

        {categorias.map((c, i) => (
          i % passoRotulo === 0 && (
            <text
              key={c} x={x(i)} y={altura - 8}
              fontSize="9.5" fill="#5A626B" textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
            >
              {rotuloCategoria(c, granularidade)}
            </text>
          )
        ))}
      </svg>
    </div>
  );
}

function Legenda({ series }) {
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
      {series.map((s) => (
        <div key={s.nome} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.cor, display: "inline-block" }} />
          <span style={{ fontSize: 12, color: "#8A939D" }}>{s.nome}</span>
          <span className="mono" style={{ fontSize: 12, color: "#EDEFF1" }}>{moeda(s.valores.reduce((a, b) => a + b, 0))}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { carregando, erro, aparelhos, pecas, servicos } = useEstoqueData();
  const [granularidade, setGranularidade] = useState("mes"); // "dia" | "mes" | "ano"

  const categorias = useMemo(() => categoriasPorGranularidade(granularidade), [granularidade]);

  function pecasDoAparelho(id) { return pecas.filter((p) => p.aparelhoId === id); }
  function custoTotalAparelho(a) { return a.valorCompra + pecasDoAparelho(a.id).reduce((s, p) => s + p.valor, 0); }
  function pecasDoServico(id) { return pecas.filter((p) => p.servicoId === id); }
  function custoPecasServico(s) { return pecasDoServico(s.id).reduce((soma, p) => soma + p.valor, 0); }
  function lucroServico(s) { return s.valorCobrado === null ? 0 : s.valorCobrado - custoPecasServico(s); }

  const vendidos = useMemo(() => aparelhos.filter((a) => a.status === "vendido"), [aparelhos]);
  const servicosConcluidos = useMemo(() => servicos.filter((s) => ETAPAS_CONCLUIDAS.includes(s.status)), [servicos]);

  // ---------- Séries alinhadas às categorias do período escolhido ----------
  const seriesFaturamento = useMemo(() => {
    const vendasPorChave = new Map();
    for (const a of vendidos) {
      const k = chaveData(a.dataSaida, granularidade);
      vendasPorChave.set(k, (vendasPorChave.get(k) || 0) + (a.valorVenda || 0));
    }
    const servicosPorChave = new Map();
    for (const s of servicosConcluidos) {
      const k = chaveData(s.dataConclusao, granularidade);
      servicosPorChave.set(k, (servicosPorChave.get(k) || 0) + (s.valorCobrado || 0));
    }
    return [
      { nome: "Vendas", cor: COR_VENDAS, valores: categorias.map((c) => vendasPorChave.get(c) || 0) },
      { nome: "Serviços", cor: COR_SERVICOS, valores: categorias.map((c) => servicosPorChave.get(c) || 0) },
    ];
  }, [vendidos, servicosConcluidos, categorias, granularidade]);

  const seriesLucro = useMemo(() => {
    const vendasPorChave = new Map();
    for (const a of vendidos) {
      const k = chaveData(a.dataSaida, granularidade);
      const lucro = (a.valorVenda || 0) - custoTotalAparelho(a);
      vendasPorChave.set(k, (vendasPorChave.get(k) || 0) + lucro);
    }
    const servicosPorChave = new Map();
    for (const s of servicosConcluidos) {
      const k = chaveData(s.dataConclusao, granularidade);
      servicosPorChave.set(k, (servicosPorChave.get(k) || 0) + lucroServico(s));
    }
    return [
      { nome: "Lucro vendas", cor: COR_VENDAS, valores: categorias.map((c) => vendasPorChave.get(c) || 0) },
      { nome: "Lucro serviços", cor: COR_SERVICOS, valores: categorias.map((c) => servicosPorChave.get(c) || 0) },
    ];
  }, [vendidos, servicosConcluidos, categorias, granularidade, pecas]);

  // ---------- Resumo histórico completo ----------
  const totalVendidoHist = vendidos.reduce((s, a) => s + (a.valorVenda || 0), 0);
  const totalLucroVendasHist = vendidos.reduce((s, a) => s + ((a.valorVenda || 0) - custoTotalAparelho(a)), 0);
  const ticketMedioVenda = vendidos.length > 0 ? totalVendidoHist / vendidos.length : 0;

  const totalCobradoServicosHist = servicosConcluidos.reduce((s, srv) => s + (srv.valorCobrado || 0), 0);
  const totalLucroServicosHist = servicosConcluidos.reduce((s, srv) => s + lucroServico(srv), 0);
  const ticketMedioServico = servicosConcluidos.length > 0 ? totalCobradoServicosHist / servicosConcluidos.length : 0;

  // ---------- Rankings de modelo ----------
  const rankingVendidos = useMemo(() => {
    const mapa = new Map();
    for (const a of vendidos) {
      const atual = mapa.get(a.modelo) || { nome: a.modelo, qtd: 0, total: 0 };
      atual.qtd += 1;
      atual.total += a.valorVenda || 0;
      mapa.set(a.modelo, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  }, [vendidos]);

  const rankingConsertados = useMemo(() => {
    const mapa = new Map();
    for (const s of servicos) {
      const atual = mapa.get(s.aparelho) || { nome: s.aparelho, qtd: 0 };
      atual.qtd += 1;
      mapa.set(s.aparelho, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  }, [servicos]);

  const maxRankingVendidos = Math.max(1, ...rankingVendidos.map((r) => r.qtd));
  const maxRankingConsertados = Math.max(1, ...rankingConsertados.map((r) => r.qtd));

  if (carregando) {
    return <div style={{ color: "#5A626B", fontSize: 13 }}>Carregando dashboard...</div>;
  }

  return (
    <div>
      <h2 className="display" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Dashboard analítico</h2>
      <p style={{ color: "#8A939D", fontSize: 13.5, margin: "0 0 24px", maxWidth: 640 }}>
        Comparativo de vendas e serviços ao longo do tempo, com ranking dos modelos que mais
        passam pela loja.
      </p>

      {erro && (
        <div style={{ color: "#D9683D", fontSize: 13, marginBottom: 16 }}>
          Não foi possível sincronizar com o banco agora. Verifique sua internet ou a
          configuração do Supabase e tente de novo.
        </div>
      )}

      {/* RESUMO HISTÓRICO */}
      <div className="grid-3-18" style={{ marginBottom: 10 }}>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Faturamento total</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{moeda(totalVendidoHist + totalCobradoServicosHist)}</div>
          <div style={{ fontSize: 11.5, color: "#5A626B", marginTop: 2 }}>{moeda(totalVendidoHist)} vendas + {moeda(totalCobradoServicosHist)} serviços</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Lucro total</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#4FB8A6" }}>{moeda(totalLucroVendasHist + totalLucroServicosHist)}</div>
          <div style={{ fontSize: 11.5, color: "#5A626B", marginTop: 2 }}>{moeda(totalLucroVendasHist)} vendas + {moeda(totalLucroServicosHist)} serviços</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Ticket médio</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{moeda(ticketMedioVenda)} <span style={{ fontSize: 11, color: "#5A626B", fontWeight: 400 }}>venda</span></div>
          <div style={{ fontSize: 11.5, color: "#5A626B", marginTop: 2 }}>{moeda(ticketMedioServico)} por serviço</div>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 28 }}>
        {vendidos.length} produto{vendidos.length === 1 ? "" : "s"} vendido{vendidos.length === 1 ? "" : "s"} · {servicosConcluidos.length} serviço{servicosConcluidos.length === 1 ? "" : "s"} concluído{servicosConcluidos.length === 1 ? "" : "s"} · histórico completo
      </div>

      {/* SELETOR DE GRANULARIDADE */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { valor: "dia", rotulo: "Por dia (últimos 30)" },
          { valor: "mes", rotulo: "Por mês (últimos 12)" },
          { valor: "ano", rotulo: "Por ano (últimos 5)" },
        ].map((op) => (
          <button
            key={op.valor}
            onClick={() => setGranularidade(op.valor)}
            className="mono"
            style={{
              background: granularidade === op.valor ? "#4FB8A622" : "transparent",
              border: `1px solid ${granularidade === op.valor ? "#4FB8A6" : "#2C3138"}`,
              color: granularidade === op.valor ? "#4FB8A6" : "#8A939D",
              borderRadius: 6, padding: "7px 14px", fontSize: 12, cursor: "pointer",
            }}
          >
            {op.rotulo}
          </button>
        ))}
      </div>

      {/* GRÁFICO: FATURAMENTO */}
      <div style={{ marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
          FATURAMENTO — VENDAS × SERVIÇOS
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "18px 16px" }}>
          <GraficoLinha categorias={categorias} granularidade={granularidade} series={seriesFaturamento} />
          <Legenda series={seriesFaturamento} />
        </div>
      </div>

      {/* GRÁFICO: LUCRO */}
      <div style={{ marginBottom: 32 }}>
        <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
          LUCRO — VENDAS × SERVIÇOS
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "18px 16px" }}>
          <GraficoLinha categorias={categorias} granularidade={granularidade} series={seriesLucro} />
          <Legenda series={seriesLucro} />
        </div>
      </div>

      {/* RANKINGS */}
      <div className="grid-main">
        <div>
          <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
            PRODUTOS MAIS VENDIDOS
          </div>
          {rankingVendidos.length === 0 ? (
            <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
              Nenhuma venda registrada ainda.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rankingVendidos.map((r) => (
                <div key={r.nome} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "10px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{r.nome}</span>
                    <span className="mono" style={{ color: "#8A939D" }}>{r.qtd} · {moeda(r.total)}</span>
                  </div>
                  <div style={{ height: 5, background: "#2C3138", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(r.qtd / maxRankingVendidos) * 100}%`, height: "100%", background: COR_VENDAS }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
            MODELOS MAIS CONSERTADOS
          </div>
          {rankingConsertados.length === 0 ? (
            <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
              Nenhum serviço registrado ainda.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rankingConsertados.map((r) => (
                <div key={r.nome} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "10px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{r.nome}</span>
                    <span className="mono" style={{ color: "#8A939D" }}>{r.qtd}</span>
                  </div>
                  <div style={{ height: 5, background: "#2C3138", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(r.qtd / maxRankingConsertados) * 100}%`, height: "100%", background: COR_SERVICOS }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
