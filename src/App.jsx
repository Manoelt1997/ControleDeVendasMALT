import { useState, useEffect } from "react";
import { supabase, supabaseConfigurado } from "./supabaseClient";
import Login from "./Login";
import Vendas from "./Vendas";
import Estoque from "./Estoque";
import Servicos from "./Servicos";
import Calculadora from "./Calculadora";
import Cotacao from "./Cotacao";
import Dashboard from "./Dashboard";

const TELAS = [
  { chave: "dashboard", rotulo: "Dashboard", Componente: Dashboard },
  { chave: "vendas", rotulo: "Vendas", Componente: Vendas },
  { chave: "estoque", rotulo: "Estoque", Componente: Estoque },
  { chave: "servicos", rotulo: "Serviços", Componente: Servicos },
  { chave: "calculadora", rotulo: "Calculadora", Componente: Calculadora },
  { chave: "cotacao", rotulo: "Cotação de Mercado", Componente: Cotacao },
];

export default function App() {
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [sessao, setSessao] = useState(null);
  const [modoRecuperacaoSenha, setModoRecuperacaoSenha] = useState(false);
  const [telaAtiva, setTelaAtiva] = useState("dashboard");

  useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregandoSessao(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregandoSessao(false);
    });

    // Detecta o link de "recuperar senha" (o Supabase te traz de volta pro site
    // com uma sessão temporária e dispara esse evento) pra mostrar a tela de
    // definir nova senha em vez de pular direto pro sistema.
    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (evento === "PASSWORD_RECOVERY") {
        setModoRecuperacaoSenha(true);
      }
      if (evento === "SIGNED_OUT") {
        setModoRecuperacaoSenha(false);
      }
      setSessao(novaSessao);
    });

    return () => assinatura.subscription.unsubscribe();
  }, []);

  async function sair() {
    await supabase.auth.signOut();
  }

  const estiloGlobal = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
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

      .grid-main { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.1fr); gap: 24px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .grid-2-16 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
      .grid-3-18 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
      .history-row { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr auto; align-items: center; gap: 12px; }
      .history-head { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr auto; gap: 12px; padding: 0 16px; margin-bottom: 6px; font-size: 10.5px; color: #5A626B; letter-spacing: 0.03em; text-transform: uppercase; }
      .history-tag { display: none; }

      .app-shell { display: flex; min-height: 100vh; background: #14171A; color: #EDEFF1; font-family: 'Inter', system-ui, sans-serif; }
      .app-sidebar { width: 216px; flex-shrink: 0; background: #16191D; border-right: 1px solid #2C3138; padding: 22px 14px; display: flex; flex-direction: column; }
      .app-sidebar-logo { display: flex; align-items: center; gap: 10px; padding: 0 6px 20px; margin-bottom: 12px; border-bottom: 1px solid #2C3138; }
      .app-nav-btn {
        display: block; width: 100%; text-align: left; background: none; border: none;
        border-left: 2px solid transparent; color: #8A939D; font-size: 13.5px; padding: 10px 12px;
        border-radius: 6px; cursor: pointer; margin-bottom: 2px; font-family: 'Inter', sans-serif;
      }
      .app-nav-btn:hover { background: #1E2228; color: #EDEFF1; }
      .app-nav-btn.ativo { background: #4FB8A61A; color: #4FB8A6; border-left-color: #4FB8A6; font-weight: 600; }
      .app-content { flex: 1; min-width: 0; padding: 32px 28px 80px; }
      .app-content-inner { max-width: 1080px; }

      @media (max-width: 860px) {
        .grid-main { grid-template-columns: 1fr; }
        .app-shell { flex-direction: column; }
        .app-sidebar { width: 100%; flex-direction: row; align-items: center; overflow-x: auto; padding: 10px 12px; gap: 6px; border-right: none; border-bottom: 1px solid #2C3138; }
        .app-sidebar-logo { display: none; }
        .app-nav-btn { width: auto; white-space: nowrap; border-left: none; border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; margin-bottom: 0; }
        .app-nav-btn.ativo { border-left-color: transparent; border-bottom-color: #4FB8A6; }
        .app-sidebar-sair { display: none; }
      }
      @media (max-width: 640px) {
        .app-content { padding: 20px 14px 64px; }
        .grid-2, .grid-2-16, .grid-3, .grid-3-18 { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .history-head { display: none; }
        .history-row { grid-template-columns: 1fr 1fr; row-gap: 10px; position: relative; padding-right: 40px !important; }
        .history-row > div:nth-child(1) { grid-column: 1 / -1; }
        .history-row > button { position: absolute; top: 12px; right: 12px; padding: 4px 8px !important; font-size: 11px !important; }
        .history-tag { display: block; font-size: 9.5px; color: #5A626B; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
      }
    `}</style>
  );

  if (carregandoSessao) {
    return (
      <>
        {estiloGlobal}
        <div style={{ minHeight: "100vh", background: "#14171A" }} />
      </>
    );
  }

  if (!sessao || modoRecuperacaoSenha) {
    return (
      <>
        {estiloGlobal}
        <Login modoRecuperacao={modoRecuperacaoSenha} />
      </>
    );
  }

  const TelaAtual = TELAS.find((t) => t.chave === telaAtiva)?.Componente || Dashboard;

  return (
    <>
      {estiloGlobal}
      <div className="app-shell">
        <div className="app-sidebar">
          <div className="app-sidebar-logo">
            <img src="/logo.png" alt="MALT Manutenção" style={{ width: 40, height: 40, borderRadius: "50%" }} />
            <div>
              <div className="display" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.15 }}>MALT</div>
              <div className="mono" style={{ fontSize: 9.5, color: "#5A626B" }}>MANUTENÇÃO</div>
            </div>
          </div>

          <nav style={{ flex: 1 }}>
            {TELAS.map((t) => (
              <button
                key={t.chave}
                onClick={() => setTelaAtiva(t.chave)}
                className={`app-nav-btn${telaAtiva === t.chave ? " ativo" : ""}`}
              >
                {t.rotulo}
              </button>
            ))}
          </nav>

          <button
            onClick={sair}
            className="app-sidebar-sair mono"
            style={{ background: "none", border: "1px solid #2C3138", color: "#8A939D", borderRadius: 6, padding: "9px 12px", fontSize: 12, cursor: "pointer", marginTop: 12 }}
          >
            Sair
          </button>
        </div>

        <div className="app-content">
          <div className="app-content-inner">
            {!supabaseConfigurado && (
              <div style={{ background: "#D9A63D22", border: "1px solid #D9A63D55", color: "#D9A63D", borderRadius: 8, padding: "14px 18px", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                <strong>Supabase não configurado.</strong> Defina <code>VITE_SUPABASE_URL</code> e{" "}
                <code>VITE_SUPABASE_ANON_KEY</code> e recarregue a página.
              </div>
            )}
            <TelaAtual />
          </div>
        </div>
      </div>
    </>
  );
}
