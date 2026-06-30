import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CRM_STATUSES, INACTIVATION_REASONS, REFERRAL_SOURCES, getCrmStatusMeta, getReasonLabel, getReferralSourceLabel, isAutoTag, tagDisplay } from "@/lib/crm";
import { CRMStatusBadge } from "@/components/crm/CRMStatusBadge";
import { CRMPatientDetailDialog, CRMPatientRow } from "@/components/crm/CRMPatientDetailDialog";
import { HeartHandshake, Search, Loader2 } from "lucide-react";

type Professional = { id: string; name: string };

export default function CRM() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<CRMPatientRow[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [referralSources, setReferralSources] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [daysWithout, setDaysWithout] = useState("");
  const [noScheduling, setNoScheduling] = useState(false);

  const [selected, setSelected] = useState<CRMPatientRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: pts, error } = await supabase
        .from("patients")
        .select("id,name,phone,email,is_active,referral_source,crm_status,crm_status_locked,crm_tags,crm_notes,inactivation_reason,inactivation_reason_other")
        .order("name");
      if (error) throw error;

      const { data: appts } = await supabase
        .from("appointments")
        .select("id,patient_id,professional_id,appointment_date,status")
        .order("appointment_date", { ascending: false });

      const { data: apMulti } = await supabase
        .from("appointment_patients")
        .select("appointment_id,patient_id");

      const { data: profs } = await supabase
        .from("professionals")
        .select("id,name")
        .order("name");

      const profMap = new Map((profs ?? []).map((p) => [p.id, p.name]));
      setProfessionals((profs ?? []) as Professional[]);

      const apMultiByAppt = new Map<string, string[]>();
      (apMulti ?? []).forEach((r: any) => {
        const arr = apMultiByAppt.get(r.appointment_id) ?? [];
        arr.push(r.patient_id);
        apMultiByAppt.set(r.appointment_id, arr);
      });

      const byPatient = new Map<string, { last?: any; attended: number }>();
      (appts ?? []).forEach((a: any) => {
        const ids = new Set<string>();
        if (a.patient_id) ids.add(a.patient_id);
        (apMultiByAppt.get(a.id) ?? []).forEach((id) => ids.add(id));
        const isAttended = ["atendido", "realizado", "concluido", "concluído"].includes(a.status);
        const isCancelled = a.status === "cancelado";
        ids.forEach((pid) => {
          const entry = byPatient.get(pid) ?? { attended: 0 };
          if (!isCancelled && !entry.last) entry.last = a;
          if (isAttended) entry.attended += 1;
          byPatient.set(pid, entry);
        });
      });

      const enriched: CRMPatientRow[] = (pts ?? []).map((p: any) => {
        const info = byPatient.get(p.id);
        return {
          ...p,
          crm_tags: p.crm_tags ?? [],
          last_appointment_date: info?.last?.appointment_date ?? null,
          last_professional_name: info?.last ? profMap.get(info.last.professional_id) ?? null : null,
          total_attended: info?.attended ?? 0,
        };
      });

      setPatients(enriched);
      setReferralSources(Array.from(new Set((pts ?? []).map((p: any) => p.referral_source).filter(Boolean))));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const today = new Date();
    return patients.filter((p) => {
      if (search) {
        const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const name = (p.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const phone = (p.phone || "").replace(/\D/g, "");
        if (!name.includes(q) && !phone.includes(q.replace(/\D/g, ""))) return false;
      }
      if (statusFilter !== "all" && (p.crm_status ?? "lead_novo") !== statusFilter) return false;
      if (activeFilter !== "all" && String(p.is_active) !== activeFilter) return false;
      if (reasonFilter !== "all" && (p.inactivation_reason ?? "") !== reasonFilter) return false;
      if (sourceFilter !== "all" && ((p as any).referral_source ?? "") !== sourceFilter) return false;
      if (tagFilter !== "all" && !p.crm_tags.includes(tagFilter)) return false;
      if (professionalFilter !== "all") {
        const prof = professionals.find((x) => x.id === professionalFilter);
        if (!prof || p.last_professional_name !== prof.name) return false;
      }
      if (noScheduling && p.last_appointment_date) return false;
      if (daysWithout) {
        const min = parseInt(daysWithout, 10);
        if (!isNaN(min)) {
          if (!p.last_appointment_date) {
          } else {
            const diff = Math.floor((today.getTime() - new Date(p.last_appointment_date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24));
            if (diff < min) return false;
          }
        }
      }
      return true;
    });
  }, [patients, search, statusFilter, activeFilter, reasonFilter, sourceFilter, tagFilter, professionalFilter, professionals, noScheduling, daysWithout]);

  const kpis = useMemo(() => {
    const counts: Record<string, number> = {};
    CRM_STATUSES.forEach((s) => (counts[s.value] = 0));
    patients.forEach((p) => {
      const k = p.crm_status ?? "lead_novo";
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return counts;
  }, [patients]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    patients.forEach((p) => p.crm_tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [patients]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <HeartHandshake className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">CRM de Pacientes</h1>
            <p className="text-sm text-muted-foreground">Gestão de relacionamento, ativação e reativação</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
          {CRM_STATUSES.map((s) => {
            const meta = getCrmStatusMeta(s.value);
            return (
              <button
                key={s.value}
                onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
                className={`text-left rounded-lg border p-3 transition hover:shadow-soft ${statusFilter === s.value ? "ring-2 ring-primary" : ""}`}
              >
                <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${meta.color}`}>{s.label}</div>
                <div className="mt-2 text-2xl font-semibold">{kpis[s.value] ?? 0}</div>
              </button>
            );
          })}
        </div>

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou telefone..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status CRM" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status CRM</SelectItem>
                {CRM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger><SelectValue placeholder="Ativo/Inativo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ativos e inativos</SelectItem>
                <SelectItem value="true">Apenas ativos</SelectItem>
                <SelectItem value="false">Apenas inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger><SelectValue placeholder="Motivo inativação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer motivo</SelectItem>
                {INACTIVATION_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
              <SelectTrigger><SelectValue placeholder="Profissional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer profissional</SelectItem>
                {professionals.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger><SelectValue placeholder="Origem de Aquisição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer origem</SelectItem>
                {REFERRAL_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger><SelectValue placeholder="Tag" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer tag</SelectItem>
                {allTags.map((t) => <SelectItem key={t} value={t}>{tagDisplay(t)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Dias sem consulta (mín.)" value={daysWithout} onChange={(e) => setDaysWithout(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={noScheduling} onChange={(e) => setNoScheduling(e.target.checked)} />
              Apenas pacientes sem agendamento
            </label>
            <Button variant="ghost" size="sm" onClick={() => {
              setSearch(""); setStatusFilter("all"); setActiveFilter("all"); setReasonFilter("all");
              setProfessionalFilter("all"); setSourceFilter("all"); setTagFilter("all");
              setDaysWithout(""); setNoScheduling(false);
            }}>Limpar filtros</Button>
            <span className="ml-auto text-sm text-muted-foreground">{filtered.length} paciente(s)</span>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-10 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Profissional recente</TableHead>
                  <TableHead>Última consulta</TableHead>
                  <TableHead>Atendidas</TableHead>
                  <TableHead>Status CRM</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => { setSelected(p); setDetailOpen(true); }}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.phone || "—"}</TableCell>
                    <TableCell>{p.last_professional_name || "—"}</TableCell>
                    <TableCell>{p.last_appointment_date ? new Date(p.last_appointment_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{p.total_attended ?? 0}</TableCell>
                    <TableCell><CRMStatusBadge status={p.crm_status} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.is_active ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.inactivation_reason ? (p.inactivation_reason === "outros" ? (p.inactivation_reason_other || "Outros") : getReasonLabel(p.inactivation_reason)) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {p.crm_tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant={isAutoTag(t) ? "secondary" : "outline"} className="text-[10px]">{tagDisplay(t)}</Badge>
                        ))}
                        {p.crm_tags.length > 3 && <span className="text-xs text-muted-foreground">+{p.crm_tags.length - 3}</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum paciente encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <CRMPatientDetailDialog
        patient={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSaved={() => load()}
      />
    </MainLayout>
  );
}
