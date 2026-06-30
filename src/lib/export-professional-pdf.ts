import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateBR, formatCurrencyBR } from "./export-utils";

export interface ProfessionalAppointmentRow {
  appointment_id: string;
  appointment_date: string;
  patient_name: string;
  consultation_value: number;
  clinic_percentage: number;
  clinic_amount: number;
  professional_amount: number;
  payment_method?: string | null;
  payment_destination?: string | null; // 'clinic' | 'professional'
  payment_status?: string | null; // appointments.payment_status: pendente / pago
  is_paid_to_professional: boolean; // professional_payments.is_paid
  confirmed_in_finance: boolean; // existe transaction de entrada vinculada (clinic) ou saída (professional)
}

export interface ProfessionalReportData {
  id: string;
  name: string;
  specialty?: string | null;
  shifts: number;
  floorPerShift: number;
  floorTotal: number;
  manualFloorEntries: number; // entradas manuais p/ piso (transactions com professional_id e tipo entrada não atreladas a appointment)
  appointments: ProfessionalAppointmentRow[];
  // Aggregates
  appointmentsCount: number;
  totalProduced: number;
  clinicTotal: number;
  professionalTotal: number;
  confirmedClinic: number;
  confirmedProfessional: number;
  pendingClinic: number;
  pendingProfessional: number;
  gapToFloor: number;
}

export interface ProfessionalsPDFData {
  periodLabel: string;
  professionals: ProfessionalReportData[];
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  transferencia: "Transferência",
  boleto: "Boleto",
};

const formatPayment = (m?: string | null) => (m ? PAYMENT_LABELS[m] || m : "-");
const formatDestination = (d?: string | null) =>
  d === "professional" ? "Profissional" : d === "clinic" ? "Clínica" : "-";

export const exportProfessionalPDF = (data: ProfessionalsPDFData, filename: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  const ensureSpace = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(14);
    doc.setFontSize(12);
    doc.setTextColor(45, 130, 120);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(45, 130, 120);
    doc.setLineWidth(0.3);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;
  };

  // ===== HEADER =====
  doc.setFontSize(20);
  doc.setTextColor(40, 60, 80);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório por Profissional", 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${data.periodLabel}`, 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
    14,
    y,
  );
  y += 4;

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Produção = consultas realizadas. Financeiro confirmado = lançamentos efetivados em transactions.",
    14,
    y + 4,
  );
  y += 12;

  if (data.professionals.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text("Nenhum profissional com dados no período.", 14, y);
    doc.save(`${filename}.pdf`);
    return;
  }

  data.professionals.forEach((p, idx) => {
    if (idx > 0) {
      doc.addPage();
      y = 20;
    }

    // ===== 1. CABEÇALHO DO PROFISSIONAL =====
    ensureSpace(18);
    doc.setFontSize(14);
    doc.setTextColor(40, 60, 80);
    doc.setFont("helvetica", "bold");
    doc.text(p.name, 14, y);
    y += 6;

    if (p.specialty) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "italic");
      doc.text(p.specialty, 14, y);
      y += 6;
    }

    // ===== 2. RESUMO GERAL =====
    sectionTitle("Resumo Geral");
    autoTable(doc, {
      startY: y,
      body: [
        ["Quantidade de turnos", String(p.shifts)],
        ["Piso por turno", formatCurrencyBR(p.floorPerShift)],
        ["Piso total do período", formatCurrencyBR(p.floorTotal)],
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 70 },
        1: { halign: "left" },
      },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ===== 3. PRODUÇÃO OPERACIONAL =====
    sectionTitle("Produção Operacional (consultas realizadas)");
    autoTable(doc, {
      startY: y,
      body: [
        ["Consultas realizadas", String(p.appointmentsCount)],
        ["Valor total das consultas", formatCurrencyBR(p.totalProduced)],
        ["Valor calculado para a clínica", formatCurrencyBR(p.clinicTotal)],
        ["Valor calculado para o profissional", formatCurrencyBR(p.professionalTotal)],
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 70 },
        1: { halign: "left" },
      },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ===== 4. FINANCEIRO CONFIRMADO =====
    sectionTitle("Financeiro Confirmado (transações efetivadas)");
    autoTable(doc, {
      startY: y,
      body: [
        ["Receita da clínica confirmada", formatCurrencyBR(p.confirmedClinic)],
        ["Repasses ao profissional confirmados", formatCurrencyBR(p.confirmedProfessional)],
        ["Entradas manuais p/ piso", formatCurrencyBR(p.manualFloorEntries)],
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 70 },
        1: { halign: "left", textColor: [34, 139, 34] },
      },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ===== 5. PENDÊNCIAS =====
    sectionTitle("Pendências");
    autoTable(doc, {
      startY: y,
      body: [
        ["Recebimentos da clínica pendentes", formatCurrencyBR(p.pendingClinic)],
        ["Repasses ao profissional pendentes", formatCurrencyBR(p.pendingProfessional)],
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 70 },
        1: { halign: "left", textColor: [200, 120, 0] },
      },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ===== 6. PISO =====
    sectionTitle("Controle de Piso");
    autoTable(doc, {
      startY: y,
      body: [
        ["Piso total", formatCurrencyBR(p.floorTotal)],
        ["Receita gerada para a clínica (confirmada)", formatCurrencyBR(p.confirmedClinic)],
        ["Entradas manuais lançadas para o piso", formatCurrencyBR(p.manualFloorEntries)],
        ["Valor restante para atingir o piso", formatCurrencyBR(p.gapToFloor)],
      ],
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 1.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 80 },
        1: { halign: "left" },
      },
      didParseCell: (hookData) => {
        if (hookData.row.index === 3 && hookData.column.index === 1) {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.textColor = p.gapToFloor > 0 ? [220, 53, 69] : [34, 139, 34];
        }
      },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ===== 7. TABELA DETALHADA =====
    if (p.appointments.length > 0) {
      sectionTitle("Consultas Detalhadas");
      const rows = p.appointments
        .slice()
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
        .map((a) => [
          formatDateBR(a.appointment_date),
          a.patient_name,
          formatCurrencyBR(a.consultation_value || 0),
          `${a.clinic_percentage || 0}%`,
          formatCurrencyBR(a.clinic_amount || 0),
          formatCurrencyBR(a.professional_amount || 0),
          formatPayment(a.payment_method),
          formatDestination(a.payment_destination),
          a.payment_status === "pago" ? "Pago" : "Pendente",
          a.confirmed_in_finance ? "Sim" : "Não",
        ]);

      autoTable(doc, {
        startY: y,
        head: [
          [
            "Data",
            "Paciente",
            "Valor",
            "% Clín.",
            "Clínica",
            "Profis.",
            "Pgto",
            "Recebeu",
            "Status",
            "Conf.",
          ],
        ],
        body: rows,
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [45, 130, 120], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          1: { cellWidth: 32 },
        },
        didParseCell: (hookData) => {
          if (hookData.section === "body") {
            // Coluna Confirmado
            if (hookData.column.index === 9) {
              const v = hookData.cell.raw as string;
              hookData.cell.styles.textColor = v === "Sim" ? [34, 139, 34] : [200, 120, 0];
              hookData.cell.styles.fontStyle = "bold";
            }
            // Coluna Status
            if (hookData.column.index === 8) {
              const v = hookData.cell.raw as string;
              hookData.cell.styles.textColor = v === "Pago" ? [34, 139, 34] : [200, 120, 0];
            }
          }
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  });

  doc.save(`${filename}.pdf`);
};
