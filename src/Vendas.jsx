import { useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { TABELA_APARELHOS, moeda, dataBR, mesLabel, hoje, intervaloPeriodo, labelPeriodo } from "./estoqueHelpers";
import { useEstoqueData } from "./useEstoqueData";

export default function Vendas() {
  const { carregando, erro, setErro, aparelhos, pecas } = useEstoqueData();

  const [filtroPeriodo, setFiltroPeriodo] = useState("mes_atual");
  const [mesPersonalizado, setMesPersonalizado] = useState(hoje().slice(0, 7));

  function pecasDoAparelho(aparelhoId) {
    return pecas.filter((p) => p.aparelhoId === aparelhoId);
  }

  function custoTotalAparelho(aparelho) {
    const somaPecas = pecasDoAparelho(aparelho.id).reduce((s, p) => s + p.valor, 0);
    return aparelho.valorCompra + somaPecas;
  }

  const vendidos = useMemo(
    () => aparelhos.filter((a) => a.status === "vendido").sort((a, b) => (b.dataSaida || "").localeCompare(a.dataSaida || "")),
    [aparelhos]
  );

  const { inicio: inicioPeriodo, fim: fimPeriodo } = useMemo(
    () => intervaloPeriodo(filtroPeriodo, mesPersonalizado),
    [filtroPeriodo, mesPersonalizado]
  );

  const vendidosPeriodo = useMemo(
    () => vendidos.filter((a) => a.dataSaida && a.dataSaida >= inicioPeriodo && a.dataSaida <= fimPeriodo),
    [vendidos, inicioPeriodo, fimPeriodo]
  );

  const totalLucroVendas = vendidosPeriodo.reduce((s, a) => s + (a.valorVenda - custoTotalAparelho(a)), 0);
  const totalVendidoValor = vendidosPeriodo.reduce((s, a) => s + (a.valorVenda || 0), 0);

  // Ranking de modelo mais vendido (histórico completo, não segue o filtro)
  const rankingModelos = useMemo(() => {
    const mapa = new Map();
    for (const a of vendidos) {
      const atual = mapa.get(a.modelo) || { modelo: a.modelo, qtd: 0, total: 0 };
      atual.qtd += 1;
      atual.total += a.valorVenda || 0;
      mapa.set(a.modelo, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [vendidos]);

  const vendasPorMes = useMemo(() => {
    const mapa = new Map();
    for (const a of vendidos) {
      if (!a.dataSaida) continue;
      const chave = a.dataSaida.slice(0, 7);
      const atual = mapa.get(chave) || { chave, total: 0, lucro: 0, qtd: 0 };
      atual.total += a.valorVenda || 0;
      atual.lucro += (a.valorVenda || 0) - custoTotalAparelho(a);
      atual.qtd += 1;
      mapa.set(chave, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  }, [vendidos, pecas]);

  const maxMes = Math.max(1, ...vendasPorMes.map((m) => m.total));

  async function removerAparelho(id) {
    const { error } = await supabase.from(TABELA_APARELHOS).delete().eq("id", id);
    if (error) setErro(true);
  }

  if (carregando) {
    return <div style={{ color: "#5A626B", fontSize: 13 }}>Carregando vendas...</div>;
  }

  return (
    <div>
      <h2 className="display" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Vendas</h2>
      <p style={{ color: "#8A939D", fontSize: 13.5, margin: "0 0 24px", maxWidth: 640 }}>
        Histórico de produtos vendidos, com lucro calculado (venda − compra − peças).
        Para dar baixa em um produto, use a tela de Estoque.
      </p>

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
              borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer",
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
            style={{ background: "#1E2228", border: "1px solid #2C3138", color: "#E4E7EB", borderRadius: 6, padding: "6px 10px", fontSize: 12.5 }}
          />
        )}
      </div>

      {/* RESUMO */}
      <div className="grid-3-18" style={{ marginBottom: 28 }}>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Vendidos</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{vendidosPeriodo.length}</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Valor vendido</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{moeda(totalVendidoValor)}</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Lucro</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#4FB8A6" }}>{moeda(totalLucroVendas)}</div>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginTop: -20, marginBottom: 28 }}>
        referente a: {labelPeriodo(filtroPeriodo, mesPersonalizado)}
      </div>

      {/* MODELO MAIS VENDIDO */}
      {rankingModelos.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
            PRODUTOS MAIS VENDIDOS <span style={{ color: "#3A4048" }}>(histórico completo)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rankingModelos.map((r, i) => (
              <div key={r.modelo} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "10px 16px" }}>
                <span className="mono" style={{ color: "#5A626B", fontSize: 12, width: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{r.modelo}</span>
                <span className="mono" style={{ fontSize: 12.5, color: "#8A939D" }}>{r.qtd} vendido{r.qtd === 1 ? "" : "s"}</span>
                <span className="mono" style={{ fontSize: 12.5, color: "#4FB8A6" }}>{moeda(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRÁFICO DE VENDAS */}
      <div style={{ marginBottom: 32 }}>
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
      <div>
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
    </div>
  );
}
