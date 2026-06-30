import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateBR, formatCurrencyBR } from './export-utils';

interface Transaction {
  transaction_date: string;
  description: string;
  type: string;
  amount: number;
  payment_method?: string | null;
}

interface Bill {
  description: string;
  category?: string | null;
  due_date: string;
  status: string;
  payment_method?: string | null;
  amount: number;
}

interface FinancialPDFData {
  periodLabel: string;
  transactions: Transaction[];
  bills: Bill[];
}

const CATEGORY_LABELS: Record<string, string> = {
  aluguel: 'Aluguel',
  energia: 'Energia',
  agua: 'Água',
  internet: 'Internet',
  material: 'Material',
  manutencao: 'Manutenção',
  impostos: 'Impostos',
  outros: 'Outros',
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  transferencia: 'Transferência',
  boleto: 'Boleto',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  vencido: 'Vencido',
};

const formatPayment = (method: string | null | undefined) =>
  method ? (PAYMENT_LABELS[method] || method) : '-';

const formatCategory = (cat: string | null | undefined) =>
  cat ? (CATEGORY_LABELS[cat] || cat) : '-';

const formatStatus = (s: string) => STATUS_LABELS[s] || s;

const getTodayString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const isOverdueBill = (bill: Bill, todayStr: string) => bill.status === 'pendente' && bill.due_date < todayStr;

const getBillStatusLabel = (bill: Bill, todayStr: string) => {
  if (bill.status === 'pago') return 'Pago';
  if (isOverdueBill(bill, todayStr)) return 'Vencido';
  return 'Pendente';
};

export const exportFinancialPDF = (data: FinancialPDFData, filename: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  const addSectionTitle = (title: string) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setTextColor(45, 130, 120);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(45, 130, 120);
    doc.setLineWidth(0.5);
    doc.line(14, y, pageWidth - 14, y);
    y += 8;
  };

  // ========== 1. HEADER ==========
  doc.setFontSize(20);
  doc.setTextColor(40, 60, 80);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Financeiro', 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${data.periodLabel}`, 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
    14,
    y
  );
  y += 12;

  // ========== 2. FINANCIAL SUMMARY ==========
  const entradas = data.transactions
    .filter((t) => t.type === 'entrada')
    .reduce((s, t) => s + t.amount, 0);
  const saidas = data.transactions
    .filter((t) => t.type === 'saida')
    .reduce((s, t) => s + t.amount, 0);
  const saldo = entradas - saidas;
  const todayStr = getTodayString();

  const billsPagas = data.bills.filter((b) => b.status === 'pago');
  const billsVencidas = data.bills.filter((b) => isOverdueBill(b, todayStr));
  const billsPendentes = data.bills.filter((b) => b.status === 'pendente' && !isOverdueBill(b, todayStr));

  addSectionTitle('Resumo Financeiro');

  const summaryRows = [
    ['Total de Entradas', formatCurrencyBR(entradas)],
    ['Total de Saídas', formatCurrencyBR(saidas)],
    ['Saldo do Período', formatCurrencyBR(saldo)],
    ['', ''],
    ['Total de Contas Pagas', `${billsPagas.length} — ${formatCurrencyBR(billsPagas.reduce((s, b) => s + b.amount, 0))}`],
    ['Total de Contas Pendentes', `${billsPendentes.length} — ${formatCurrencyBR(billsPendentes.reduce((s, b) => s + b.amount, 0))}`],
    ['Total de Contas Vencidas', `${billsVencidas.length} — ${formatCurrencyBR(billsVencidas.reduce((s, b) => s + b.amount, 0))}`],
    ['', ''],
    ['Qtd. de Transações', String(data.transactions.length)],
    ['Qtd. de Contas no Período', String(data.bills.length)],
  ];

  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { halign: 'left' },
    },
    didParseCell: (hookData) => {
      // Highlight saldo row
      if (hookData.row.index === 2 && hookData.column.index === 1) {
        hookData.cell.styles.textColor = saldo >= 0 ? [34, 139, 34] : [220, 53, 69];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ========== 3. EXPENSES BY CATEGORY ==========
  const saidaTransactions = data.transactions.filter((t) => t.type === 'saida');
  const totalSaidas = saidaTransactions.reduce((s, t) => s + t.amount, 0);

  // Also include bills as expense sources for category grouping
  const categoryMap: Record<string, { count: number; total: number }> = {};

  // From bills (primary source of categorized expenses)
  data.bills.forEach((b) => {
    const cat = b.category || 'outros';
    if (!categoryMap[cat]) categoryMap[cat] = { count: 0, total: 0 };
    categoryMap[cat].count++;
    categoryMap[cat].total += b.amount;
  });

  const totalCategorized = Object.values(categoryMap).reduce((s, v) => s + v.total, 0);

  if (Object.keys(categoryMap).length > 0) {
    addSectionTitle('Despesas por Categoria');

    const catRows = Object.entries(categoryMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, v]) => [
        formatCategory(cat),
        String(v.count),
        formatCurrencyBR(v.total),
        totalCategorized > 0 ? `${((v.total / totalCategorized) * 100).toFixed(1)}%` : '0%',
      ]);

    // Add total row
    catRows.push([
      'TOTAL',
      String(Object.values(categoryMap).reduce((s, v) => s + v.count, 0)),
      formatCurrencyBR(totalCategorized),
      '100%',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Categoria', 'Qtd.', 'Valor Total', '% do Total']],
      body: catRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [45, 130, 120], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (hookData) => {
        if (hookData.row.index === catRows.length - 1 && hookData.section === 'body') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [230, 240, 238];
        }
      },
      margin: { left: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ========== 4. BILLS BY STATUS ==========
  addSectionTitle('Contas a Pagar por Status');

  const statusGroups = [
    { label: 'Pago', items: billsPagas },
    { label: 'Pendente', items: billsPendentes },
    { label: 'Vencido', items: billsVencidas },
  ];

  const statusRows = statusGroups.map((g) => [
    g.label,
    String(g.items.length),
    formatCurrencyBR(g.items.reduce((s, b) => s + b.amount, 0)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Status', 'Quantidade', 'Valor Total']],
    body: statusRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [45, 130, 120], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 0) {
        const status = hookData.cell.raw as string;
        if (status === 'Vencido') hookData.cell.styles.textColor = [220, 53, 69];
        if (status === 'Pendente') hookData.cell.styles.textColor = [255, 165, 0];
        if (status === 'Pago') hookData.cell.styles.textColor = [34, 139, 34];
      }
    },
    margin: { left: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ========== 5. DETAILED TRANSACTIONS TABLE ==========
  if (data.transactions.length > 0) {
    addSectionTitle('Transações Detalhadas');

    const txRows = data.transactions
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
      .map((t) => [
        formatDateBR(t.transaction_date),
        t.description,
        t.type === 'entrada' ? 'Entrada' : 'Saída',
        formatPayment(t.payment_method),
        formatCurrencyBR(t.amount),
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Descrição', 'Tipo', 'Forma Pgto.', 'Valor']],
      body: txRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [45, 130, 120], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 1: { cellWidth: 60 } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const tipo = hookData.cell.raw as string;
          hookData.cell.styles.textColor = tipo === 'Entrada' ? [34, 139, 34] : [220, 53, 69];
        }
      },
      margin: { left: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ========== 6. DETAILED BILLS TABLE ==========
  if (data.bills.length > 0) {
    addSectionTitle('Contas a Pagar — Detalhado');

    const billRows = data.bills
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map((b) => [
        b.description,
        formatCategory(b.category),
        formatDateBR(b.due_date),
        getBillStatusLabel(b, todayStr),
        formatPayment(b.payment_method),
        formatCurrencyBR(b.amount),
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Descrição', 'Categoria', 'Vencimento', 'Status', 'Forma Pgto.', 'Valor']],
      body: billRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [45, 130, 120], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 0: { cellWidth: 45 } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const status = hookData.cell.raw as string;
          if (status === 'Vencido') hookData.cell.styles.textColor = [220, 53, 69];
          if (status === 'Pendente') hookData.cell.styles.textColor = [255, 165, 0];
          if (status === 'Pago') hookData.cell.styles.textColor = [34, 139, 34];
        }
      },
      margin: { left: 14 },
    });
  }

  doc.save(`${filename}.pdf`);
};
