import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2, FileText, Download } from "lucide-react";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface AttachmentsTabProps {
  entityType: "professional" | "patient";
  entityId: string;
}

export function AttachmentsTab({ entityType, entityId }: AttachmentsTabProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAttachments();
  }, [entityId]);

  const fetchAttachments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (!error && data) setAttachments(data);
    setIsLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${entityType}/${entityId}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);

      await supabase.from("attachments").insert({
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
      });
    }

    toast({ title: "Arquivo(s) enviado(s)!" });
    fetchAttachments();
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (attachment: Attachment) => {
    const { error } = await supabase.from("attachments").delete().eq("id", attachment.id);
    if (!error) {
      toast({ title: "Anexo removido!" });
      fetchAttachments();
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          Enviar Arquivo
        </Button>
      </div>

      {attachments.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">Nenhum anexo</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between p-3 rounded-lg border border-border/30">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{att.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(att.file_size)} • {new Date(att.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" asChild>
                  <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(att)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
