import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  TABELA_COTACOES, moeda, dataBR, PLATAFORMAS, corPlataforma,
  linkBuscaPlataforma, linhaParaCotacao,
} from "./estoqueHelpers";

function media(lista) {
  if (lista.length === 0) return 0;
  return lista.reduce((s, v) => s + v, 0) / lista.length;
}

export default function Cotacao() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [cotacoes, setCotacoes] = useState([]);

  const [produtoNovo, setProdutoNovo] = useState("");
  const [cotacaoAbertaId, setCotacaoAbertaId] = useState(null);
  const [plataformaForm, setPlataformaForm] = useState("mercado_livre");
  const [precoForm, setPrecoForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  // edição de custo de compra / margem mínima (inline, por cotação)
  const [custoEditId, setCustoEditId] = useState(null);
  const [custoEditValor, setCustoEditValor] = useState("");
  const [custoEditMargem, setCustoEditMargem] = useState("20");
  const [salvandoCusto, setSalvandoCusto] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      const { data, error } = await supabase.from(TABELA_COTACOES).select("*").order("atualizado_em", { ascending: false });
      if (!ativo) return;
      if (error) { setErro(true); } else { setCotacoes(data.map(linhaParaCotacao)); setErro(false); }
      setCarregando(false);
    }
    carregar();

    const canal = supabase
      .channel("cotacoes-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: TABELA_COTACOES }, (payload) => {
        if (payload.eventType === "INSERT") {
          const nova = linhaParaCotacao(payload.new);
          setCotacoes((atual) => (atual.some((c) => c.id === nova.id) ? atual : [nova, ...atual]));
        } else if (payload.eventType === "DELETE") {
          setCotacoes((atual) => atual.filter((c) => c.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          const atualizada = linhaParaCotacao(payload.new);
          setCotacoes((atual) => atual.map((c) => (c.id === atualizada.id ? atualizada : c)));
        }
      })
      .subscribe();

    return () => { ativo = false; supabase.removeChannel(canal); };
  }, []);

  const cotacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return cotacoes;
    return cotacoes.filter((c) => c.produto.toLowerCase().includes(termo));
  }, [cotacoes, busca]);

  function estatisticas(cotacao) {
    const precos = cotacao.itens.map((i) => i.preco);
    const mediaGeral = media(precos);
    const porPlataforma = PLATAFORMAS.map((p) => {
      const valores = cotacao.itens.filter((i) => i.plataforma === p.chave).map((i) => i.preco);
      return { ...p, media: media(valores), qtd: valores.length };
    });
    return {
      mediaGeral,
      min: precos.length ? Math.min(...precos) : 0,
      max: precos.length ? Math.max(...precos) : 0,
      qtd: precos.length,
      porPlataforma,
    };
  }

  // Compara o que você pagaria (valorCompra) com o que o mercado pesquisado está cobrando,
  // e devolve a faixa de revenda: do mínimo (ainda com a margem mínima garantida) ao máximo
  // (o maior preço real visto na pesquisa — acima disso você provavelmente não vende rápido).
  function analiseRevenda(cotacao, stats) {
    if (!cotacao.valorCompra || stats.qtd === 0) return null;
    const custo = cotacao.valorCompra;
    const margem = cotacao.margemMinima ?? 20;
    const precoMinimoComMargem = custo * (1 + margem / 100);
    // O mínimo pra vender é o maior entre "cobrir a margem mínima" e "o menor preço visto no
    // mercado" — não adianta ter margem se ninguém paga isso; e não adianta seguir o mercado
    // se isso te dá prejuízo.
    const precoMinimoRevenda = Math.max(precoMinimoComMargem, 0);
    const precoMaximoRevenda = stats.max;
    const lucroMedia = stats.mediaGeral - custo;
    const lucroMinimo = precoMinimoRevenda - custo;
    const lucroMaximo = precoMaximoRevenda - custo;
    const margemMedia = custo > 0 ? (lucroMedia / custo) * 100 : 0;

    let veredito, corVeredito;
    if (stats.mediaGeral <= custo) {
      veredito = "Não compensa — a média do mercado está abaixo do que você pagaria.";
      corVeredito = "#D9683D";
    } else if (precoMinimoRevenda > precoMaximoRevenda) {
      veredito = "Margem apertada — o preço mínimo pra cobrir sua margem ficou acima do maior preço visto no mercado.";
      corVeredito = "#D9A63D";
    } else if (margemMedia < margem) {
      veredito = "Compensa, mas com margem abaixo do que você definiu como mínima.";
      corVeredito = "#D9A63D";
    } else {
      veredito = "Vale a pena — dá pra vender dentro da margem que você quer.";
      corVeredito = "#4FB8A6";
    }

    return { custo, precoMinimoRevenda, precoMaximoRevenda, lucroMedia, lucroMinimo, lucroMaximo, margemMedia, veredito, corVeredito };
  }

  function abrirEdicaoCusto(cotacao) {
    setCustoEditId(cotacao.id);
    setCustoEditValor(cotacao.valorCompra !== null ? String(cotacao.valorCompra) : "");
    setCustoEditMargem(String(cotacao.margemMinima ?? 20));
  }

  async function salvarCusto(cotacao) {
    setSalvandoCusto(true);
    const { error } = await supabase
      .from(TABELA_COTACOES)
      .update({
        valor_compra: custoEditValor !== "" ? Number(custoEditValor) : null,
        margem_minima: custoEditMargem !== "" ? Number(custoEditMargem) : 20,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", cotacao.id);
    setSalvandoCusto(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setCustoEditId(null);
  }

  async function criarCotacao() {
    if (!produtoNovo.trim()) return;
    setSalvando(true);
    const { data, error } = await supabase
      .from(TABELA_COTACOES)
      .insert({ produto: produtoNovo.trim(), itens: [] })
      .select()
      .single();
    setSalvando(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setProdutoNovo("");
    if (data) setCotacaoAbertaId(data.id);
  }

  function abrirAdicaoPreco(cotacaoId) {
    setCotacaoAbertaId(cotacaoId);
    setPlataformaForm("mercado_livre");
    setPrecoForm("");
  }

  async function adicionarPreco(cotacao) {
    if (Number(precoForm) <= 0) return;
    setSalvando(true);
    const novoItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      plataforma: plataformaForm,
      preco: Number(precoForm),
      criado_em: new Date().toISOString(),
    };
    const itensAtualizados = [...cotacao.itens, novoItem];
    const { error } = await supabase
      .from(TABELA_COTACOES)
      .update({ itens: itensAtualizados, atualizado_em: new Date().toISOString() })
      .eq("id", cotacao.id);
    setSalvando(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setPrecoForm("");
  }

  async function removerPreco(cotacao, itemId) {
    const itensAtualizados = cotacao.itens.filter((i) => i.id !== itemId);
    const { error } = await supabase
      .from(TABELA_COTACOES)
      .update({ itens: itensAtualizados, atualizado_em: new Date().toISOString() })
      .eq("id", cotacao.id);
    if (error) setErro(true);
  }

  async function removerCotacao(id) {
    const { error } = await supabase.from(TABELA_COTACOES).delete().eq("id", id);
    if (error) setErro(true);
  }

  if (carregando) {
    return <div style={{ color: "#5A626B", fontSize: 13 }}>Carregando cotações...</div>;
  }

  return (
    <div>
      <h2 className="display" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Cotação de Mercado</h2>
      <p style={{ color: "#8A939D", fontSize: 13.5, margin: "0 0 24px", maxWidth: 640 }}>
        Pesquise o preço de um produto no Mercado Livre, Facebook Marketplace e OLX, registre o
        que você viu, e o app calcula a média — geral e por plataforma. Fica salvo como
        referência pra próxima vez.
      </p>

      {erro && (
        <div style={{ color: "#D9683D", fontSize: 13, marginBottom: 16 }}>
          Não foi possível sincronizar com o banco agora. Verifique sua internet ou a
          configuração do Supabase e tente de novo.
        </div>
      )}

      <div style={{ background: "#1E2228", border: "1px dashed #3A4048", borderRadius: 10, padding: 22, marginBottom: 28, position: "relative" }}>
        <div className="mono" style={{ position: "absolute", top: -10, left: 20, background: "#14171A", padding: "0 8px", fontSize: 11, color: "#5A626B" }}>
          NOVA COTAÇÃO
        </div>
        <div className="field">
          <label>Produto</label>
          <input value={produtoNovo} onChange={(e) => setProdutoNovo(e.target.value)} placeholder="Ex: iPhone 12 128GB seminovo" />
        </div>
        {produtoNovo.trim() && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {PLATAFORMAS.map((p) => (
              <a
                key={p.chave}
                href={linkBuscaPlataforma(p.chave, produtoNovo.trim())}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{ fontSize: 11.5, padding: "6px 12px", borderRadius: 6, border: `1px solid ${p.cor}`, color: p.cor, textDecoration: "none" }}
              >
                Buscar no {p.rotulo} ↗
              </a>
            ))}
          </div>
        )}
        <button
          onClick={criarCotacao}
          disabled={salvando || !produtoNovo.trim()}
          className="mono"
          style={{
            width: "100%", background: "#4FB8A6", color: "#14171A", border: "none",
            borderRadius: 6, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            opacity: salvando || !produtoNovo.trim() ? 0.5 : 1,
          }}
        >
          Criar cotação e começar a registrar preços
        </button>
      </div>

      {cotacoes.length > 3 && (
        <div className="field" style={{ maxWidth: 320 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto já cotado..." />
        </div>
      )}

      {cotacoesFiltradas.length === 0 ? (
        <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
          {cotacoes.length === 0 ? "Nenhuma cotação registrada ainda." : "Nenhum produto encontrado com esse termo."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cotacoesFiltradas.map((c) => {
            const stats = estatisticas(c);
            return (
              <div key={c.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{c.produto}</div>
                    <div style={{ color: "#5A626B", fontSize: 11.5, marginTop: 2 }}>
                      {stats.qtd} preço{stats.qtd === 1 ? "" : "s"} coletado{stats.qtd === 1 ? "" : "s"} · atualizado {dataBR(c.atualizadoEm?.slice(0, 10))}
                    </div>
                  </div>
                  {stats.qtd > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div className="mono" style={{ fontSize: 19, fontWeight: 700, color: "#4FB8A6" }}>{moeda(stats.mediaGeral)}</div>
                      <div style={{ fontSize: 10.5, color: "#5A626B" }}>média geral · {moeda(stats.min)} – {moeda(stats.max)}</div>
                    </div>
                  )}
                </div>

                {stats.qtd > 0 && (
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid #2C3138" }}>
                    {stats.porPlataforma.map((p) => (
                      <div key={p.chave} style={{ minWidth: 110 }}>
                        <div className="mono" style={{ fontSize: 10, color: p.cor, marginBottom: 2 }}>{p.rotulo.toUpperCase()}</div>
                        <div className="mono" style={{ fontSize: 14 }}>{p.qtd > 0 ? moeda(p.media) : "—"}</div>
                        <div style={{ fontSize: 10, color: "#5A626B" }}>{p.qtd} anúncio{p.qtd === 1 ? "" : "s"}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CUSTO DE COMPRA + ANÁLISE DE REVENDA */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #2C3138" }}>
                  {custoEditId === c.id ? (
                    <div>
                      <div className="grid-2">
                        <div className="field" style={{ marginBottom: 8 }}>
                          <label>Preço que você encontrou pra comprar</label>
                          <input type="number" inputMode="decimal" value={custoEditValor} onChange={(e) => setCustoEditValor(e.target.value)} placeholder="0,00" />
                        </div>
                        <div className="field" style={{ marginBottom: 8 }}>
                          <label>Margem mínima desejada (%)</label>
                          <input type="number" inputMode="decimal" value={custoEditMargem} onChange={(e) => setCustoEditMargem(e.target.value)} placeholder="20" />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => salvarCusto(c)}
                          disabled={salvandoCusto}
                          className="mono"
                          style={{ background: "#4FB8A6", color: "#14171A", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: salvandoCusto ? 0.5 : 1 }}
                        >
                          {salvandoCusto ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          onClick={() => setCustoEditId(null)}
                          style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : c.valorCompra ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                        <div style={{ fontSize: 12.5, color: "#8A939D" }}>
                          Comprando por <span className="mono" style={{ color: "#EDEFF1", fontWeight: 600 }}>{moeda(c.valorCompra)}</span>
                          <span style={{ color: "#5A626B" }}> · margem mínima {c.margemMinima}%</span>
                        </div>
                        <button
                          onClick={() => abrirEdicaoCusto(c)}
                          className="mono"
                          style={{ background: "none", border: "none", color: "#4FB8A6", fontSize: 11.5, cursor: "pointer", padding: 0 }}
                        >
                          editar
                        </button>
                      </div>

                      {stats.qtd > 0 && (() => {
                        const analise = analiseRevenda(c, stats);
                        return (
                          <div style={{ background: "#14171A", border: "1px solid #2C3138", borderRadius: 8, padding: "12px 14px" }}>
                            <div className="grid-2" style={{ marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 10.5, color: "#5A626B" }}>Revenda mínima</div>
                                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{moeda(analise.precoMinimoRevenda)}</div>
                                <div style={{ fontSize: 10, color: "#5A626B" }}>lucro {moeda(analise.lucroMinimo)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10.5, color: "#5A626B" }}>Revenda máxima</div>
                                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{moeda(analise.precoMaximoRevenda)}</div>
                                <div style={{ fontSize: 10, color: "#5A626B" }}>lucro {moeda(analise.lucroMaximo)}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 11.5, color: "#8A939D", marginBottom: 8 }}>
                              Vendendo pela média (<span className="mono">{moeda(stats.mediaGeral)}</span>): lucro de{" "}
                              <span className="mono" style={{ color: analise.lucroMedia >= 0 ? "#4FB8A6" : "#D9683D" }}>{moeda(analise.lucroMedia)}</span>{" "}
                              ({analise.margemMedia.toFixed(0)}% de margem)
                            </div>
                            <div style={{ fontSize: 11.5, color: analise.corVeredito, fontWeight: 600 }}>{analise.veredito}</div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <button
                      onClick={() => abrirEdicaoCusto(c)}
                      className="mono"
                      style={{ background: "transparent", color: "#8A939D", border: "1px dashed #2C3138", borderRadius: 6, padding: "8px 14px", fontSize: 12, cursor: "pointer", width: "100%" }}
                    >
                      + Informar preço de compra pra analisar se compensa revender
                    </button>
                  )}
                </div>

                {c.itens.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                    {c.itens.map((it) => (
                      <span
                        key={it.id}
                        className="mono"
                        style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: `${corPlataforma(it.plataforma)}1A`, color: corPlataforma(it.plataforma), border: `1px solid ${corPlataforma(it.plataforma)}55`, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        {moeda(it.preco)}
                        <button
                          onClick={() => removerPreco(c, it.id)}
                          style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1 }}
                          title="Remover este preço"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {cotacaoAbertaId === c.id ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2C3138" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {PLATAFORMAS.map((p) => (
                        <a
                          key={p.chave}
                          href={linkBuscaPlataforma(p.chave, c.produto)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono"
                          style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: `1px solid ${p.cor}`, color: p.cor, textDecoration: "none" }}
                        >
                          {p.rotulo} ↗
                        </a>
                      ))}
                    </div>
                    <div className="grid-2">
                      <div className="field">
                        <label>Plataforma</label>
                        <select value={plataformaForm} onChange={(e) => setPlataformaForm(e.target.value)}>
                          {PLATAFORMAS.map((p) => (
                            <option key={p.chave} value={p.chave}>{p.rotulo}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Preço encontrado</label>
                        <input type="number" inputMode="decimal" value={precoForm} onChange={(e) => setPrecoForm(e.target.value)} placeholder="0,00" />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => adicionarPreco(c)}
                        disabled={salvando || Number(precoForm) <= 0}
                        className="mono"
                        style={{
                          background: "#4FB8A6", color: "#14171A", border: "none", borderRadius: 6,
                          padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                          opacity: salvando || Number(precoForm) <= 0 ? 0.5 : 1,
                        }}
                      >
                        Adicionar preço
                      </button>
                      <button
                        onClick={() => setCotacaoAbertaId(null)}
                        style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, cursor: "pointer" }}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid #2C3138" }}>
                    <button
                      onClick={() => abrirAdicaoPreco(c.id)}
                      className="mono"
                      style={{ background: "transparent", color: "#4FB8A6", border: "1px solid #4FB8A6", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                    >
                      + Adicionar preço
                    </button>
                    <button
                      onClick={() => removerCotacao(c.id)}
                      style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                    >
                      Remover cotação
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
