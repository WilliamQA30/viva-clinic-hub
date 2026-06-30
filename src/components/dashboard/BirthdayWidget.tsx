import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cake } from "lucide-react";
import { format } from "date-fns";

interface BirthdayPerson {
  name: string;
  type: "paciente" | "profissional";
}

export function BirthdayWidget() {
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);

  useEffect(() => {
    fetchBirthdays();
  }, []);

  const fetchBirthdays = async () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const mmdd = `${month}-${day}`;

    const [{ data: patients }, { data: professionals }] = await Promise.all([
      supabase
        .from("patients")
        .select("name, birth_date")
        .eq("is_active", true)
        .not("birth_date", "is", null),
      supabase
        .from("professionals")
        .select("name, birth_date")
        .eq("is_active", true)
        .not("birth_date", "is", null),
    ]);

    const list: BirthdayPerson[] = [];

    patients?.forEach((p) => {
      if (p.birth_date && p.birth_date.slice(5) === mmdd) {
        list.push({ name: p.name, type: "paciente" });
      }
    });

    professionals?.forEach((p) => {
      if (p.birth_date && p.birth_date.slice(5) === mmdd) {
        list.push({ name: p.name, type: "profissional" });
      }
    });

    setBirthdays(list);
  };

  if (birthdays.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border/30 shadow-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
          <Cake className="w-4 h-4 text-warning" />
        </div>
        <h3 className="font-semibold text-foreground">🎂 Aniversariantes de Hoje</h3>
      </div>
      <div className="space-y-2">
        {birthdays.map((person, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <span className="text-sm font-medium text-foreground">{person.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
              {person.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
