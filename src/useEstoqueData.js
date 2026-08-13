import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import {
  TABELA_APARELHOS,
  TABELA_PECAS,
  TABELA_SERVICOS,
  linhaParaAparelho,
  linhaParaPeca,
  linhaParaServico,
} from "./estoqueHelpers";

// Hook compartilhado pelas telas de Estoque, Vendas e Serviços — carrega as
// três tabelas relacionadas ao negócio de revenda/reparo e mantém tudo
// sincronizado em tempo real. Cada tela usa só o que precisa dos dados.
export function useEstoqueData() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [aparelhos, setAparelhos] = useState([]);
  const [pecas, setPecas] = useState([]);
  const [servicos, setServicos] = useState([]);

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

  return { carregando, erro, setErro, aparelhos, pecas, servicos, setAparelhos, setPecas, setServicos };
}
