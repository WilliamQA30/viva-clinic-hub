import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendWhatsAppRequest {
  phone: string;
  message: string;
  appointmentId?: string;
  patientName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.log("Evolution API credentials not configured - skipping WhatsApp");
      return new Response(
        JSON.stringify({ success: false, error: "Evolution API not configured", optional: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove trailing slash from URL if present
    evolutionApiUrl = evolutionApiUrl.replace(/\/+$/, "");

    const { phone, message, appointmentId, patientName } = await req.json() as SendWhatsAppRequest;

    if (!phone || !message) {
      throw new Error("Phone and message are required");
    }

    // Format phone number:
    // - If user provided +country code, keep it
    // - If starts with 55, keep as Brazil with country code
    // - If has up to 11 digits without country code, assume Brazil
    // - Otherwise assume international number already includes country code
    const trimmedPhone = phone.trim();
    const hasPlusPrefix = trimmedPhone.startsWith("+");
    const digitsOnlyPhone = trimmedPhone.replace(/\D/g, "");

    if (!digitsOnlyPhone) {
      throw new Error("Invalid phone number");
    }

    let formattedPhone = digitsOnlyPhone;

    if (!hasPlusPrefix && !digitsOnlyPhone.startsWith("55") && digitsOnlyPhone.length <= 11) {
      formattedPhone = `55${digitsOnlyPhone}`;
    }

    // Send message via Evolution API
    // Instance name should match what's configured in Evolution API
    const instanceName = "EspacoEssentia";
    const apiEndpoint = `${evolutionApiUrl}/message/sendText/${instanceName}`;
    
    console.log("Sending WhatsApp to:", formattedPhone, "via:", apiEndpoint);
    
    let response;
    let result;
    
    try {
      response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": evolutionApiKey,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      });
      
      result = await response.json();
    } catch (fetchError: any) {
      console.error("Fetch error to Evolution API:", fetchError);
      // Return success anyway - WhatsApp is optional, don't break the flow
      return new Response(
        JSON.stringify({ success: false, error: "Evolution API unreachable", optional: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      console.error("Evolution API error:", result);
      // Return without throwing - WhatsApp is optional
      return new Response(
        JSON.stringify({ success: false, error: result.message || "WhatsApp API error", optional: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("system_logs").insert({
      action: "whatsapp_sent",
      entity_type: "appointment",
      entity_id: appointmentId || null,
      description: `Mensagem WhatsApp enviada para ${patientName || phone}`,
      metadata: { phone: formattedPhone, message_preview: message.substring(0, 100) },
    });

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending WhatsApp:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});