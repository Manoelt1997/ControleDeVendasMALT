import { useState } from "react";
import { supabase, supabaseConfigurado } from "./supabaseClient";

// Tela de login com usuário/senha reais (Supabase Auth). Não existe cadastro
// público aqui de propósito — as contas são criadas por você direto no
// painel do Supabase (Authentication → Users → Add user). Veja o README.
export default function Login({ modoRecuperacao }) {
  const [modo, setModo] = useState(modoRecuperacao ? "nova_senha" : "entrar"); // "entrar" | "esqueci" | "esqueci_enviado" | "nova_senha" | "nova_senha_ok"
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(e) {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setCarregando(true);
    setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) {
      setErro(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    }
    // Sucesso: o App detecta a sessão via onAuthStateChange e troca de tela sozinho.
  }

  async function enviarRecuperacao(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setCarregando(true);
    setErro("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setModo("esqueci_enviado");
  }

  async function salvarNovaSenha(e) {
    e.preventDefault();
    if (novaSenha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErro("As senhas não coincidem.");
      return;
    }
    setCarregando(true);
    setErro("");
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setModo("nova_senha_ok");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#14171A",
        color: "#EDEFF1",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <img src="/logo.png" alt="MALT Manutenção" style={{ width: 84, height: 84, borderRadius: "50%", marginBottom: 12 }} />
          <div className="display" style={{ fontSize: 19, fontWeight: 700 }}>MALT Manutenção</div>
          <div className="mono" style={{ fontSize: 11.5, color: "#5A626B", marginTop: 2 }}>CONTROLE DE VENDAS E REPAROS</div>
        </div>

        {!supabaseConfigurado && (
          <div style={{ background: "#D9A63D22", border: "1px solid #D9A63D55", color: "#D9A63D", borderRadius: 8, padding: "12px 16px", fontSize: 12.5, marginBottom: 20, lineHeight: 1.6 }}>
            Supabase não configurado — defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
          </div>
        )}

        <div style={{ background: "#1E2228", border: "1px solid #2C3138", borderRadius: 12, padding: 26 }}>
          {modo === "entrar" && (
            <form onSubmit={entrar}>
              <div className="field">
                <label>E-mail</label>
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              <div className="field">
                <label>Senha</label>
                <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required />
              </div>
              {erro && <div style={{ color: "#D9683D", fontSize: 12.5, marginBottom: 14 }}>{erro}</div>}
              <button
                type="submit"
                disabled={carregando || !supabaseConfigurado}
                className="mono"
                style={{
                  width: "100%", background: "#4FB8A6", color: "#14171A", border: "none", borderRadius: 6,
                  padding: "11px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: carregando || !supabaseConfigurado ? 0.6 : 1,
                }}
              >
                {carregando ? "Entrando..." : "Entrar"}
              </button>
              <button
                type="button"
                onClick={() => { setModo("esqueci"); setErro(""); }}
                style={{ display: "block", width: "100%", background: "none", border: "none", color: "#8A939D", fontSize: 12.5, marginTop: 14, cursor: "pointer" }}
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {modo === "esqueci" && (
            <form onSubmit={enviarRecuperacao}>
              <p style={{ color: "#8A939D", fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.5 }}>
                Informe o e-mail da sua conta. Vamos mandar um link pra você definir uma nova senha.
              </p>
              <div className="field">
                <label>E-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
              {erro && <div style={{ color: "#D9683D", fontSize: 12.5, marginBottom: 14 }}>{erro}</div>}
              <button
                type="submit"
                disabled={carregando}
                className="mono"
                style={{
                  width: "100%", background: "#4FB8A6", color: "#14171A", border: "none", borderRadius: 6,
                  padding: "11px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: carregando ? 0.6 : 1,
                }}
              >
                {carregando ? "Enviando..." : "Enviar link de recuperação"}
              </button>
              <button
                type="button"
                onClick={() => { setModo("entrar"); setErro(""); }}
                style={{ display: "block", width: "100%", background: "none", border: "none", color: "#8A939D", fontSize: 12.5, marginTop: 14, cursor: "pointer" }}
              >
                Voltar
              </button>
            </form>
          )}

          {modo === "esqueci_enviado" && (
            <div>
              <p style={{ color: "#EDEFF1", fontSize: 13.5, margin: "0 0 8px", lineHeight: 1.6 }}>
                Link enviado para <strong>{email}</strong>.
              </p>
              <p style={{ color: "#8A939D", fontSize: 12.5, margin: "0 0 18px", lineHeight: 1.6 }}>
                Abra o e-mail e clique no link — ele vai te trazer de volta aqui pra você definir a nova senha.
              </p>
              <button
                type="button"
                onClick={() => { setModo("entrar"); setErro(""); }}
                className="mono"
                style={{ width: "100%", background: "transparent", color: "#4FB8A6", border: "1px solid #4FB8A6", borderRadius: 6, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}
              >
                Voltar para o login
              </button>
            </div>
          )}

          {modo === "nova_senha" && (
            <form onSubmit={salvarNovaSenha}>
              <p style={{ color: "#8A939D", fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.5 }}>
                Defina sua nova senha.
              </p>
              <div className="field">
                <label>Nova senha</label>
                <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Pelo menos 6 caracteres" required />
              </div>
              <div className="field">
                <label>Confirmar nova senha</label>
                <input type="password" value={confirmarNovaSenha} onChange={(e) => setConfirmarNovaSenha(e.target.value)} placeholder="Repita a senha" required />
              </div>
              {erro && <div style={{ color: "#D9683D", fontSize: 12.5, marginBottom: 14 }}>{erro}</div>}
              <button
                type="submit"
                disabled={carregando}
                className="mono"
                style={{
                  width: "100%", background: "#4FB8A6", color: "#14171A", border: "none", borderRadius: 6,
                  padding: "11px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: carregando ? 0.6 : 1,
                }}
              >
                {carregando ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          )}

          {modo === "nova_senha_ok" && (
            <div>
              <p style={{ color: "#EDEFF1", fontSize: 13.5, margin: "0 0 18px", lineHeight: 1.6 }}>
                Senha alterada! Você já está conectado — pode fechar esta mensagem e usar o sistema normalmente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
