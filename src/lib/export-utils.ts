import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  title: string;
  subtitle?: string;
}

export const exportToPDF = (data: ExportData, filename: string) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(40, 60, 80);
  doc.text(data.title, 14, 22);
  
  // Subtitle
  if (data.subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(data.subtitle, 14, 30);
  }

  // Date
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, data.subtitle ? 38 : 30);

  // Table
  autoTable(doc, {
    head: [data.headers],
    body: data.rows,
    startY: data.subtitle ? 45 : 37,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [45, 130, 120],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 10 },
  });

  doc.save(`${filename}.pdf`);
};

export const exportToExcel = (data: ExportData, filename: string) => {
  const ws = XLSX.utils.aoa_to_sheet([
    [data.title],
    data.subtitle ? [data.subtitle] : [],
    [`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`],
    [],
    data.headers,
    ...data.rows,
  ].filter(row => row.length > 0));

  // Set column widths
  const colWidths = data.headers.map((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...data.rows.map(row => String(row[i] || '').length)
    );
    return { wch: Math.min(maxLength + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const formatDateBR = (date: string) => {
  if (!date) return '-';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
};

export const formatCurrencyBR = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return `R$ ${(isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
