import { CalendarPlus, UserPlus, Receipt, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const actions = [
  {
    name: "Nova Consulta",
    description: "Agendar atendimento",
    icon: CalendarPlus,
    href: "/agenda",
    color: "gradient-primary",
  },
  {
    name: "Novo Paciente",
    description: "Cadastrar paciente",
    icon: UserPlus,
    href: "/pacientes",
    color: "gradient-success",
  },
  {
    name: "Lançar Receita",
    description: "Registrar pagamento",
    icon: Receipt,
    href: "/financeiro",
    color: "gradient-accent",
  },
  {
    name: "Bloquear Horário",
    description: "Férias ou folga",
    icon: Clock,
    href: "/profissionais",
    color: "bg-warning",
  },
];

export function QuickActions() {
  return (
    <div className="bg-card rounded-xl border border-border/30 shadow-card p-5">
      <h3 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link
            key={action.name}
            to={action.href}
            className="group p-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-primary/20 transition-all duration-200"
          >
            <div
              className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}
            >
              <action.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <p className="font-medium text-foreground text-sm">{action.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
