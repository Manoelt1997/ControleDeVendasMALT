import { jsPDF } from "jspdf";
import { moeda, dataBR, rotuloEtapa } from "./estoqueHelpers";

const NOME_EMPRESA = "MALT Manutenção";
const SLOGAN_EMPRESA = "Celulares, Computadores, Videogames";

// Busca a logo (public/logo.png) e converte pra base64, formato que o jsPDF exige
// pra desenhar imagens. Roda no navegador, não precisa de nenhum serviço externo.
async function logoBase64() {
  try {
    const resp = await fetch("/logo.png");
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onloadend = () => resolve(leitor.result);
      leitor.onerror = reject;
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null; // Sem logo, o PDF é gerado normalmente, só sem a imagem.
  }
}

// Gera o PDF do orçamento de uma OS e dispara o download no navegador.
// pecasVinculadas: array de peças (já filtradas pro serviço) vindas de estoqueHelpers.
export async function gerarOrcamentoPDF(servico, pecasVinculadas) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margemEsq = 18;
  const larguraUtil = 210 - margemEsq * 2;
  let y = 20;

  const logo = await logoBase64();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margemEsq, y - 4, 20, 20);
    } catch {
      // Formato de imagem não suportado pelo jsPDF — segue sem a logo.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(NOME_EMPRESA, margemEsq + 26, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text(SLOGAN_EMPRESA, margemEsq + 26, y + 9);
  doc.setTextColor(0);

  y += 26;
  doc.setDrawColor(220);
  doc.line(margemEsq, y, margemEsq + larguraUtil, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Orçamento de Serviço", margemEsq, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text(`Emitido em ${dataBR(new Date().toISOString().slice(0, 10))}`, margemEsq + larguraUtil, y, { align: "right" });
  doc.setTextColor(0);
  y += 10;

  // ---------- Dados do cliente e do aparelho ----------
  const linhaDado = (rotulo, valor) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(rotulo, margemEsq, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(valor || "—"), margemEsq + 32, y);
    y += 6;
  };

  linhaDado("Cliente:", servico.cliente);
  linhaDado("Aparelho:", servico.aparelho);
  if (servico.numeroSerie) linhaDado("Nº série / IMEI:", servico.numeroSerie);
  if (servico.cor) linhaDado("Cor:", servico.cor);
  linhaDado("Defeito relatado:", servico.defeito || "—");
  linhaDado("Status atual:", rotuloEtapa(servico.status));
  y += 4;

  doc.setDrawColor(220);
  doc.line(margemEsq, y, margemEsq + larguraUtil, y);
  y += 10;

  // ---------- Tabela: peças + mão de obra ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Discriminação", margemEsq, y);
  y += 8;

  const colDescricaoX = margemEsq;
  const colValorX = margemEsq + larguraUtil;

  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text("Item", colDescricaoX, y);
  doc.text("Valor", colValorX, y, { align: "right" });
  doc.setTextColor(0);
  y += 2;
  doc.setDrawColor(230);
  doc.line(margemEsq, y, margemEsq + larguraUtil, y);
  y += 6;

  const custoPecas = pecasVinculadas.reduce((s, p) => s + p.valor, 0);
  const valorTotal = servico.valorCobrado || 0;
  const maoDeObra = Math.max(0, valorTotal - custoPecas);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const p of pecasVinculadas) {
    doc.text(p.nomePeca, colDescricaoX, y);
    doc.text(moeda(p.valor), colValorX, y, { align: "right" });
    y += 7;
  }
  doc.text("Mão de obra / serviço", colDescricaoX, y);
  doc.text(moeda(maoDeObra), colValorX, y, { align: "right" });
  y += 7;

  doc.setDrawColor(220);
  doc.line(margemEsq, y, margemEsq + larguraUtil, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text("Total", colDescricaoX, y);
  doc.text(moeda(valorTotal), colValorX, y, { align: "right" });
  y += 14;

  // ---------- Observações e validade ----------
  if (servico.observacao) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Observações:", margemEsq, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const linhas = doc.splitTextToSize(servico.observacao, larguraUtil);
    doc.text(linhas, margemEsq, y);
    y += linhas.length * 5 + 6;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(130);
  doc.text("Orçamento válido por 7 dias a partir da data de emissão. Sujeito a alteração caso", margemEsq, y);
  y += 4.5;
  doc.text("sejam identificados problemas adicionais durante a manutenção.", margemEsq, y);

  const nomeArquivo = `orcamento_${(servico.cliente || "cliente").replace(/\s+/g, "_").toLowerCase()}_${servico.aparelho.replace(/\s+/g, "_").toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}
