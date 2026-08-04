import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listPatients from "./tools/list-patients";
import getPatient from "./tools/get-patient";
import createPatient from "./tools/create-patient";
import updatePatient from "./tools/update-patient";
import listAppointments from "./tools/list-appointments";
import createAppointment from "./tools/create-appointment";
import updateAppointment from "./tools/update-appointment";
import listProfessionals from "./tools/list-professionals";
import professionalEarnings from "./tools/professional-earnings";
import financialSummary from "./tools/financial-summary";
import listTransactions from "./tools/list-transactions";
import listBills from "./tools/list-bills";
import createBill from "./tools/create-bill";
import dashboardStats from "./tools/dashboard-stats";
import crmOverview from "./tools/crm-overview";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "remix-of-clinica-flow",
  title: "Remix of Clínica Flow",
  version: "0.1.0",
  instructions:
    "Ferramentas do sistema de gestão da clínica de psicologia Espaço Essentia Tianguá. " +
    "Permite consultar e gerenciar pacientes, agenda de consultas, profissionais, financeiro " +
    "(transações e contas a pagar), indicadores do dashboard e o CRM de pacientes. " +
    "Regras do negócio: a tabela de transações é a única fonte de faturamento; a comissão da clínica é de 25%; " +
    "a sessão padrão dura 50 minutos; salas disponíveis: Harmonia, Serenidade, Florescer e Online. " +
    "Datas usam o formato AAAA-MM-DD. Todas as chamadas respeitam as permissões do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listPatients,
    getPatient,
    createPatient,
    updatePatient,
    listAppointments,
    createAppointment,
    updateAppointment,
    listProfessionals,
    professionalEarnings,
    financialSummary,
    listTransactions,
    listBills,
    createBill,
    dashboardStats,
    crmOverview,
  ],
});
