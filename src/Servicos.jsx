import { useState, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  TABELA_PECAS, TABELA_SERVICOS, moeda, dataBR, hoje, intervaloPeriodo, labelPeriodo,
  BUCKET_FOTOS_OS, ETAPAS_OS, ETAPAS_CONCLUIDAS, rotuloEtapa, corEtapa,
  CATEGORIAS_OS, CHECKLIST_ITENS, ESTADOS_CHECKLIST,
} from "./estoqueHelpers";
import { useEstoqueData } from "./useEstoqueData";
import { gerarOrcamentoPDF } from "./gerarOrcamentoPDF";

function urlFoto(path) {
  return supabase.storage.from(BUCKET_FOTOS_OS).getPublicUrl(path).data.publicUrl;
}

// Grupo de 3 botões (Não testado / OK / Defeito) pra um item do checklist.
function SeletorChecklist({ rotulo, valor, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
      <span style={{ fontSize: 12.5, color: "#C7CCD1" }}>{rotulo}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {ESTADOS_CHECKLIST.map((e) => (
          <button
            key={e.chave}
            type="button"
            onClick={() => onChange(e.chave)}
            className="mono"
            style={{
              fontSize: 10, padding: "4px 8px", borderRadius: 5, cursor: "pointer",
              border: `1px solid ${valor === e.chave ? e.cor : "#2C3138"}`,
              background: valor === e.chave ? `${e.cor}22` : "transparent",
              color: valor === e.chave ? e.cor : "#5A626B",
            }}
          >
            {e.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagsChecklist({ checklist, categoria }) {
  const itens = CHECKLIST_ITENS[categoria] || [];
  const preenchidos = itens.filter((it) => checklist[it.chave] && checklist[it.chave] !== "nao_testado");
  if (preenchidos.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
      {preenchidos.map((it) => {
        const estado = ESTADOS_CHECKLIST.find((e) => e.chave === checklist[it.chave]);
        return (
          <span
            key={it.chave}
            className="mono"
            style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${estado.cor}1A`, color: estado.cor, border: `1px solid ${estado.cor}55` }}
          >
            {it.rotulo}: {estado.rotulo}
          </span>
        );
      })}
    </div>
  );
}

export default function Servicos() {
  const { carregando, erro, setErro, pecas, servicos, setServicos } = useEstoqueData();

  const [filtroPeriodo, setFiltroPeriodo] = useState("mes_atual");
  const [mesPersonalizado, setMesPersonalizado] = useState(hoje().slice(0, 7));

  // form: nova OS
  const [clienteServico, setClienteServico] = useState("");
  const [categoriaServico, setCategoriaServico] = useState("celular");
  const [aparelhoServico, setAparelhoServico] = useState("");
  const [numeroSerieServico, setNumeroSerieServico] = useState("");
  const [corServico, setCorServico] = useState("");
  const [senhaServico, setSenhaServico] = useState("");
  const [defeitoServico, setDefeitoServico] = useState("");
  const [dataEntradaServico, setDataEntradaServico] = useState(hoje());
  const [valorCobradoServico, setValorCobradoServico] = useState("");
  const [observacaoServico, setObservacaoServico] = useState("");
  const [checklistServico, setChecklistServico] = useState({});
  const [salvandoServico, setSalvandoServico] = useState(false);

  // form: nova peça
  const [nomePeca, setNomePeca] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valorPeca, setValorPeca] = useState("");
  const [dataCompraPeca, setDataCompraPeca] = useState(hoje());
  const [servicoPecaId, setServicoPecaId] = useState("");
  const [salvandoPeca, setSalvandoPeca] = useState(false);

  // form: mover pra "Entregue" (pede data + valor final, igual antes)
  const [conclusaoAbertaId, setConclusaoAbertaId] = useState(null);
  const [dataConclusao, setDataConclusao] = useState(hoje());
  const [valorCobradoFinal, setValorCobradoFinal] = useState("");
  const [salvandoConclusao, setSalvandoConclusao] = useState(false);

  const [enviandoFotosId, setEnviandoFotosId] = useState(null);
  const [gerandoPdfId, setGerandoPdfId] = useState(null);

  function pecasDoServico(servicoId) {
    return pecas.filter((p) => p.servicoId === servicoId);
  }
  function custoPecasServico(servico) {
    return pecasDoServico(servico.id).reduce((s, p) => s + p.valor, 0);
  }
  function lucroServico(servico) {
    if (servico.valorCobrado === null || servico.valorCobrado === undefined) return null;
    return servico.valorCobrado - custoPecasServico(servico);
  }

  const emAndamento = useMemo(
    () => servicos.filter((s) => !ETAPAS_CONCLUIDAS.includes(s.status)).sort((a, b) => (b.dataEntrada || "").localeCompare(a.dataEntrada || "")),
    [servicos]
  );
  const concluidos = useMemo(
    () => servicos.filter((s) => ETAPAS_CONCLUIDAS.includes(s.status)).sort((a, b) => (b.dataConclusao || "").localeCompare(a.dataConclusao || "")),
    [servicos]
  );
  const totalAReceber = emAndamento.reduce((s, srv) => s + (srv.valorCobrado || 0), 0);

  const { inicio: inicioPeriodo, fim: fimPeriodo } = useMemo(
    () => intervaloPeriodo(filtroPeriodo, mesPersonalizado),
    [filtroPeriodo, mesPersonalizado]
  );
  const concluidosPeriodo = useMemo(
    () => concluidos.filter((s) => s.dataConclusao && s.dataConclusao >= inicioPeriodo && s.dataConclusao <= fimPeriodo),
    [concluidos, inicioPeriodo, fimPeriodo]
  );
  const totalLucroPeriodo = concluidosPeriodo.reduce((s, srv) => s + (lucroServico(srv) || 0), 0);

  const rankingModelos = useMemo(() => {
    const mapa = new Map();
    for (const s of servicos) {
      const atual = mapa.get(s.aparelho) || { aparelho: s.aparelho, qtd: 0 };
      atual.qtd += 1;
      mapa.set(s.aparelho, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [servicos]);

  function marcarChecklist(chave, estado) {
    setChecklistServico((atual) => ({ ...atual, [chave]: estado }));
  }

  async function adicionarServico() {
    if (!clienteServico.trim() || !aparelhoServico.trim()) return;
    setSalvandoServico(true);
    const { error } = await supabase.from(TABELA_SERVICOS).insert({
      cliente: clienteServico.trim(),
      categoria: categoriaServico,
      aparelho: aparelhoServico.trim(),
      numero_serie: numeroSerieServico.trim() || null,
      cor: corServico.trim() || null,
      senha_desbloqueio: senhaServico.trim() || null,
      defeito: defeitoServico.trim() || null,
      data_entrada: dataEntradaServico,
      valor_cobrado: valorCobradoServico !== "" ? Number(valorCobradoServico) : null,
      observacao: observacaoServico.trim() || null,
      checklist_entrada: checklistServico,
      fotos: [],
      status: "aguardando_avaliacao",
    });
    setSalvandoServico(false);
    if (error) { setErro(true); return; }
    setErro(false);
    setClienteServico("");
    setCategoriaServico("celular");
    setAparelhoServico("");
    setNumeroSerieServico("");
    setCorServico("");
    setSenhaServico("");
    setDefeitoServico("");
    setValorCobradoServico("");
    setObservacaoServico("");
    setChecklistServico({});
    setDataEntradaServico(hoje());
  }

  async function adicionarPeca() {
    if (!nomePeca.trim() || Number(valorPeca) <= 0) return;
    setSalvandoPeca(true);
    const { error } = await supabase.from(TABELA_PECAS).insert({
      aparelho_id: null,
      servico_id: servicoPecaId || null,
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
    setServicoPecaId("");
    setDataCompraPeca(hoje());
  }

  // Muda a etapa da OS. Indo pra "entregue", abre o mini-formulário pedindo data + valor final
  // (assim como antes); pras demais etapas, atualiza direto.
  async function mudarEtapa(servico, novaEtapa) {
    if (novaEtapa === "entregue") {
      setConclusaoAbertaId(servico.id);
      setDataConclusao(hoje());
      setValorCobradoFinal(servico.valorCobrado !== null ? String(servico.valorCobrado) : "");
      return;
    }
    const { error } = await supabase.from(TABELA_SERVICOS).update({ status: novaEtapa }).eq("id", servico.id);
    if (error) setErro(true);
  }

  async function confirmarConclusao(id) {
    if (Number(valorCobradoFinal) <= 0) return;
    setSalvandoConclusao(true);
    const { error } = await supabase
      .from(TABELA_SERVICOS)
      .update({ status: "entregue", data_conclusao: dataConclusao, valor_cobrado: Number(valorCobradoFinal) || 0 })
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

  // ---------- Fotos ----------
  async function enviarFotos(servico, arquivos) {
    if (!arquivos || arquivos.length === 0) return;
    setEnviandoFotosId(servico.id);
    try {
      const novasFotos = [];
      for (const arquivo of arquivos) {
        const caminho = `${servico.id}/${Date.now()}_${arquivo.name}`;
        const { error } = await supabase.storage.from(BUCKET_FOTOS_OS).upload(caminho, arquivo);
        if (error) throw error;
        novasFotos.push({ path: caminho, nome: arquivo.name, criado_em: new Date().toISOString() });
      }
      const fotosAtualizadas = [...(servico.fotos || []), ...novasFotos];
      const { error: erroUpdate } = await supabase.from(TABELA_SERVICOS).update({ fotos: fotosAtualizadas }).eq("id", servico.id);
      if (erroUpdate) throw erroUpdate;
      setServicos((atual) => atual.map((s) => (s.id === servico.id ? { ...s, fotos: fotosAtualizadas } : s)));
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setEnviandoFotosId(null);
    }
  }

  async function removerFoto(servico, foto) {
    try {
      await supabase.storage.from(BUCKET_FOTOS_OS).remove([foto.path]);
      const fotosAtualizadas = (servico.fotos || []).filter((f) => f.path !== foto.path);
      await supabase.from(TABELA_SERVICOS).update({ fotos: fotosAtualizadas }).eq("id", servico.id);
      setServicos((atual) => atual.map((s) => (s.id === servico.id ? { ...s, fotos: fotosAtualizadas } : s)));
    } catch {
      setErro(true);
    }
  }

  async function baixarOrcamento(servico) {
    setGerandoPdfId(servico.id);
    try {
      await gerarOrcamentoPDF(servico, pecasDoServico(servico.id));
    } catch {
      setErro(true);
    } finally {
      setGerandoPdfId(null);
    }
  }

  if (carregando) {
    return <div style={{ color: "#5A626B", fontSize: 13 }}>Carregando ordens de serviço...</div>;
  }

  return (
    <div>
      <h2 className="display" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Serviços (Ordem de Serviço)</h2>
      <p style={{ color: "#8A939D", fontSize: 13.5, margin: "0 0 24px", maxWidth: 640 }}>
        Reparos de clientes com checklist de entrada, fotos do estado do aparelho, fluxo de
        status completo e geração de orçamento em PDF.
      </p>

      {erro && (
        <div style={{ color: "#D9683D", fontSize: 13, marginBottom: 16 }}>
          Não foi possível sincronizar com o banco agora. Verifique sua internet ou a
          configuração do Supabase e tente de novo.
        </div>
      )}

      <div className="grid-2-16" style={{ marginBottom: 28 }}>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Em andamento</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{emAndamento.length}</div>
          <div style={{ fontSize: 12, color: "#5A626B", marginTop: 2 }}>{moeda(totalAReceber)} a receber</div>
        </div>
        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8A939D" }}>Lucro (entregues/garantia)</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#4FB8A6" }}>{moeda(totalLucroPeriodo)}</div>
          <div style={{ fontSize: 12, color: "#5A626B", marginTop: 2 }}>{labelPeriodo(filtroPeriodo, mesPersonalizado)}</div>
        </div>
      </div>

      {rankingModelos.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
            MODELOS MAIS CONSERTADOS <span style={{ color: "#3A4048" }}>(histórico completo)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rankingModelos.map((r, i) => (
              <div key={r.aparelho} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "10px 16px" }}>
                <span className="mono" style={{ color: "#5A626B", fontSize: 12, width: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{r.aparelho}</span>
                <span className="mono" style={{ fontSize: 12.5, color: "#8A939D" }}>{r.qtd} serviço{r.qtd === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-main">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#1E2228", border: "1px dashed #3A4048", borderRadius: 10, padding: 22, position: "relative" }}>
            <div className="mono" style={{ position: "absolute", top: -10, left: 20, background: "#14171A", padding: "0 8px", fontSize: 11, color: "#5A626B" }}>
              NOVA ORDEM DE SERVIÇO — CHECK-IN
            </div>

            <div className="field">
              <label>Categoria do aparelho</label>
              <select value={categoriaServico} onChange={(e) => { setCategoriaServico(e.target.value); setChecklistServico({}); }}>
                {CATEGORIAS_OS.map((c) => (
                  <option key={c.chave} value={c.chave}>{c.rotulo}</option>
                ))}
              </select>
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
                <label>{categoriaServico === "celular" ? "IMEI" : "Nº de série"} (opcional)</label>
                <input value={numeroSerieServico} onChange={(e) => setNumeroSerieServico(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="field">
                <label>Cor (opcional)</label>
                <input value={corServico} onChange={(e) => setCorServico(e.target.value)} placeholder="Ex: Preto" />
              </div>
            </div>

            {categoriaServico === "celular" && (
              <div className="field">
                <label>Senha / padrão de desbloqueio (opcional)</label>
                <input value={senhaServico} onChange={(e) => setSenhaServico(e.target.value)} placeholder="Ex: 1234 ou padrão em L" />
              </div>
            )}

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
                <label>Valor a cobrar (opcional)</label>
                <input type="number" inputMode="decimal" value={valorCobradoServico} onChange={(e) => setValorCobradoServico(e.target.value)} placeholder="0,00" />
              </div>
              <div className="field">
                <label>Observação (opcional)</label>
                <input value={observacaoServico} onChange={(e) => setObservacaoServico(e.target.value)} placeholder="Ex: orçamento aprovado" />
              </div>
            </div>

            <div style={{ background: "#14171A", border: "1px solid #2C3138", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <div className="mono" style={{ fontSize: 10.5, color: "#5A626B", marginBottom: 4 }}>CHECKLIST DE ENTRADA</div>
              {(CHECKLIST_ITENS[categoriaServico] || []).map((item) => (
                <SeletorChecklist
                  key={item.chave}
                  rotulo={item.rotulo}
                  valor={checklistServico[item.chave] || "nao_testado"}
                  onChange={(estado) => marcarChecklist(item.chave, estado)}
                />
              ))}
            </div>

            <div style={{ fontSize: 11, color: "#5A626B", marginBottom: 14, lineHeight: 1.5 }}>
              As fotos do estado do aparelho são adicionadas depois de criar a OS, no card dela
              na coluna ao lado.
            </div>

            <button
              onClick={adicionarServico}
              disabled={salvandoServico || !clienteServico.trim() || !aparelhoServico.trim()}
              className="mono"
              style={{
                width: "100%", background: "#4FB8A6", color: "#14171A", border: "none",
                borderRadius: 6, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: salvandoServico || !clienteServico.trim() || !aparelhoServico.trim() ? 0.5 : 1,
              }}
            >
              {salvandoServico ? "Salvando..." : "Abrir OS"}
            </button>
          </div>

          <div style={{ background: "#1E2228", border: "1px dashed #3A4048", borderRadius: 10, padding: 22, position: "relative" }}>
            <div className="mono" style={{ position: "absolute", top: -10, left: 20, background: "#14171A", padding: "0 8px", fontSize: 11, color: "#5A626B" }}>
              COMPRA DE PEÇA
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Peça</label>
                <input value={nomePeca} onChange={(e) => setNomePeca(e.target.value)} placeholder="Ex: Tela Moto G54" />
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
              <label>Vincular a uma OS (opcional)</label>
              <select value={servicoPecaId} onChange={(e) => setServicoPecaId(e.target.value)}>
                <option value="">Nenhum / estoque de peças avulso</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.cliente} — {s.aparelho}{ETAPAS_CONCLUIDAS.includes(s.status) ? ` (${rotuloEtapa(s.status)})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={adicionarPeca}
              disabled={salvandoPeca || !nomePeca.trim() || Number(valorPeca) <= 0}
              className="mono"
              style={{
                width: "100%", background: "transparent", color: "#4FB8A6",
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
            EM ANDAMENTO ({emAndamento.length})
          </div>
          {emAndamento.length === 0 ? (
            <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
              Nenhuma OS em andamento no momento.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {emAndamento.map((s) => {
                const pecasVinc = pecasDoServico(s.id);
                const custoPecas = custoPecasServico(s);
                const categoriaRotulo = CATEGORIAS_OS.find((c) => c.chave === s.categoria)?.rotulo || s.categoria;
                return (
                  <div key={s.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {s.aparelho} <span style={{ color: "#8A939D", fontWeight: 400 }}>· {s.cliente}</span>
                        </div>
                        <div style={{ color: "#8A939D", fontSize: 12 }}>
                          {categoriaRotulo} · entrada {dataBR(s.dataEntrada)}{s.numeroSerie ? ` · ${s.numeroSerie}` : ""}{s.cor ? ` · ${s.cor}` : ""}
                        </div>
                        {s.defeito && <div style={{ color: "#8A939D", fontSize: 12, marginTop: 2 }}>{s.defeito}</div>}
                        <TagsChecklist checklist={s.checklistEntrada} categoria={s.categoria} />
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

                    {/* Fotos */}
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      {(s.fotos || []).map((f) => (
                        <div key={f.path} style={{ position: "relative" }}>
                          <img src={urlFoto(f.path)} alt={f.nome} style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 5, border: "1px solid #2C3138" }} />
                          <button
                            onClick={() => removerFoto(s, f)}
                            title="Remover foto"
                            style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: "#D9683D", color: "#14171A", border: "none", fontSize: 10, lineHeight: "16px", cursor: "pointer", padding: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <label
                        className="mono"
                        style={{ fontSize: 10.5, color: "#4FB8A6", border: "1px dashed #4FB8A6", borderRadius: 5, padding: "13px 10px", cursor: "pointer" }}
                      >
                        {enviandoFotosId === s.id ? "Enviando..." : "+ Foto"}
                        <input
                          type="file" accept="image/*" multiple style={{ display: "none" }}
                          disabled={enviandoFotosId === s.id}
                          onChange={(e) => { enviarFotos(s, Array.from(e.target.files)); e.target.value = ""; }}
                        />
                      </label>
                    </div>

                    {conclusaoAbertaId === s.id ? (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #2C3138" }}>
                        <div className="grid-2">
                          <div className="field" style={{ marginBottom: 8 }}>
                            <label>Data de entrega</label>
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
                              background: "#4FB8A6", color: "#14171A", border: "none", borderRadius: 6,
                              padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                              opacity: salvandoConclusao || Number(valorCobradoFinal) <= 0 ? 0.5 : 1,
                            }}
                          >
                            {salvandoConclusao ? "Salvando..." : "Confirmar entrega"}
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
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #2C3138" }}>
                        <div className="field" style={{ marginBottom: 8 }}>
                          <label>Etapa</label>
                          <select
                            value={s.status}
                            onChange={(e) => mudarEtapa(s, e.target.value)}
                            style={{ borderColor: corEtapa(s.status), color: corEtapa(s.status) }}
                          >
                            {ETAPAS_OS.map((et) => (
                              <option key={et.chave} value={et.chave}>{et.rotulo}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => baixarOrcamento(s)}
                            disabled={gerandoPdfId === s.id}
                            className="mono"
                            style={{ background: "transparent", color: "#4FB8A6", border: "1px solid #4FB8A6", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", opacity: gerandoPdfId === s.id ? 0.5 : 1 }}
                          >
                            {gerandoPdfId === s.id ? "Gerando..." : "Gerar orçamento (PDF)"}
                          </button>
                          <button
                            onClick={() => removerServico(s.id)}
                            style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FILTRO DE PERÍODO (histórico) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "32px 0 20px" }}>
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

      <div>
        <div className="mono" style={{ fontSize: 11, color: "#5A626B", marginBottom: 10 }}>
          HISTÓRICO — ENTREGUES / GARANTIA ({concluidosPeriodo.length}) — {labelPeriodo(filtroPeriodo, mesPersonalizado)}
        </div>
        {concluidosPeriodo.length === 0 ? (
          <div style={{ border: "1px dashed #2C3138", borderRadius: 10, padding: 22, textAlign: "center", color: "#5A626B", fontSize: 13 }}>
            Nenhuma OS entregue em {labelPeriodo(filtroPeriodo, mesPersonalizado)}.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {concluidosPeriodo.map((s) => {
              const custoPecas = custoPecasServico(s);
              const lucro = lucroServico(s) || 0;
              return (
                <div key={s.id} style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {s.aparelho} <span style={{ color: "#8A939D", fontWeight: 400 }}>· {s.cliente}</span>
                      <span className="mono" style={{ fontSize: 10, marginLeft: 8, color: corEtapa(s.status), border: `1px solid ${corEtapa(s.status)}55`, borderRadius: 4, padding: "1px 6px" }}>
                        {rotuloEtapa(s.status)}
                      </span>
                    </div>
                    <div style={{ color: "#8A939D", fontSize: 12 }}>
                      entrada {dataBR(s.dataEntrada)} · entregue {dataBR(s.dataConclusao)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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
                    <select
                      value={s.status}
                      onChange={(e) => mudarEtapa(s, e.target.value)}
                      className="mono"
                      style={{ fontSize: 11, padding: "5px 8px", width: "auto", borderColor: corEtapa(s.status), color: corEtapa(s.status) }}
                    >
                      {ETAPAS_OS.map((et) => (
                        <option key={et.chave} value={et.chave}>{et.rotulo}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => baixarOrcamento(s)}
                      disabled={gerandoPdfId === s.id}
                      className="mono"
                      style={{ background: "transparent", color: "#4FB8A6", border: "1px solid #4FB8A6", borderRadius: 6, padding: "6px 10px", fontSize: 11.5, cursor: "pointer", opacity: gerandoPdfId === s.id ? 0.5 : 1 }}
                    >
                      PDF
                    </button>
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
    </div>
  );
}
