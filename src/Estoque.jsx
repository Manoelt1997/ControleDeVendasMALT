import { useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { TABELA_APARELHOS, TABELA_PECAS, moeda, hoje, dataBR } from "./estoqueHelpers";
import { useEstoqueData } from "./useEstoqueData";

export default function Estoque() {
  const { carregando, erro, setErro, aparelhos, pecas } = useEstoqueData();

  // form: novo aparelho
  const [modelo, setModelo] = useState("");
  const [marca, setMarca] = useState("");
  const [dataEntrada, setDataEntrada] = useState(hoje());
  const [valorCompra, setValorCompra] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvandoAparelho, setSalvandoAparelho] = useState(false);

  // form: nova peça (vinculada a um aparelho do estoque, ou avulsa)
  const [nomePeca, setNomePeca] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valorPeca, setValorPeca] = useState("");
  const [dataCompraPeca, setDataCompraPeca] = useState(hoje());
  const [aparelhoPecaId, setAparelhoPecaId] = useState("");
  const [salvandoPeca, setSalvandoPeca] = useState(false);

  // form: registrar venda (inline, por aparelho)
  const [vendaAbertaId, setVendaAbertaId] = useState(null);
  const [dataSaida, setDataSaida] = useState(hoje());
  const [valorVenda, setValorVenda] = useState("");
  const [comprador, setComprador] = useState("");
  const [salvandoVenda, setSalvandoVenda] = useState(false);

  function pecasDoAparelho(aparelhoId) {
    return pecas.filter((p) => p.aparelhoId === aparelhoId);
  }

  function custoTotalAparelho(aparelho) {
    const somaPecas = pecasDoAparelho(aparelho.id).reduce((s, p) => s + p.valor, 0);
    return aparelho.valorCompra + somaPecas;
  }

  const emEstoque = useMemo(
    () => aparelhos.filter((a) => a.status !== "vendido").sort((a, b) => (b.dataEntrada || "").localeCompare(a.dataEntrada || "")),
    [aparelhos]
  );
  const totalInvestidoEstoque = emEstoque.reduce((s, a) => s + custoTotalAparelho(a), 0);

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
    setSalvandoPeca(true);
    const { error } = await supabase.from(TABELA_PECAS).insert({
      aparelho_id: aparelhoPecaId || null,
      servico_id: null,
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
    setAparelhoPecaId("");
    setDataCompraPeca(hoje());
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

  if (carregando) {
    return <div style={{ color: "#5A626B", fontSize: 13 }}>Carregando estoque...</div>;
  }

  return (
    <div>
      <h2 className="display" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Estoque</h2>
      <p style={{ color: "#8A939D", fontSize: 13.5, margin: "0 0 24px", maxWidth: 640 }}>
        Aparelhos comprados para revender e as peças usadas neles. Registre a entrada, acompanhe
        o custo total e dê baixa quando vender.
      </p>

      {erro && (
        <div style={{ color: "#D9683D", fontSize: 13, marginBottom: 16 }}>
          Não foi possível sincronizar com o banco agora. Verifique sua internet ou a
          configuração do Supabase e tente de novo.
        </div>
      )}

      <div className="grid-2-16" style={{ marginBottom: 28 }}>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Em estoque agora</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{emEstoque.length} aparelho{emEstoque.length === 1 ? "" : "s"}</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Total investido</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{moeda(totalInvestidoEstoque)}</div>
        </div>
      </div>

      <div className="grid-main">
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
                width: "100%", marginTop: 6, background: "#4FB8A6", color: "#14171A", border: "none",
                borderRadius: 6, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: salvandoAparelho || !modelo.trim() || Number(valorCompra) <= 0 ? 0.5 : 1,
              }}
            >
              {salvandoAparelho ? "Salvando..." : "Registrar entrada"}
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
              <label>Vincular a um aparelho (opcional)</label>
              <select value={aparelhoPecaId} onChange={(e) => setAparelhoPecaId(e.target.value)}>
                <option value="">Nenhum / estoque de peças avulso</option>
                {aparelhos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.modelo} — entrada {dataBR(a.dataEntrada)}{a.status === "vendido" ? " (vendido)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={adicionarPeca}
              disabled={salvandoPeca || !nomePeca.trim() || Number(valorPeca) <= 0}
              className="mono"
              style={{
                width: "100%", marginTop: 6, background: "transparent", color: "#4FB8A6",
                border: "1px solid #4FB8A6", borderRadius: 6, padding: "10px 14px", fontSize: 13,
                fontWeight: 600, cursor: "pointer",
                opacity: salvandoPeca || !nomePeca.trim() || Number(valorPeca) <= 0 ? 0.5 : 1,
              }}
            >
              {salvandoPeca ? "Salvando..." : "Registrar compra de peça"}
            </button>
          </div>
        </div>

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
                              background: "#4FB8A6", color: "#14171A", border: "none", borderRadius: 6,
                              padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
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
