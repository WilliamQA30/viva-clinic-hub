import { MainLayout } from "@/components/layout/MainLayout";
import { AIAssistantPanel } from "@/components/settings/AIAssistantPanel";

export default function Assistente() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-header">Assistente IA</h1>
          <p className="page-subtitle">Tire dúvidas sobre como usar o sistema</p>
        </div>

        <div className="bg-card rounded-xl border border-border/30 shadow-card p-6">
          <AIAssistantPanel />
        </div>
      </div>
    </MainLayout>
  );
}
