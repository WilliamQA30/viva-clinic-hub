import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Evolution API not configured",
          configured: false 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove trailing slash from URL if present
    evolutionApiUrl = evolutionApiUrl.replace(/\/+$/, "");

    const { action } = await req.json();
    const instanceName = "EspacoEssentia";

    // Get connection status
    if (action === "status") {
      try {
        const response = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceName}`, {
          method: "GET",
          headers: {
            "apikey": evolutionApiKey,
          },
        });

        if (!response.ok) {
          // Instance might not exist
          if (response.status === 404) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                configured: true,
                connected: false,
                status: "not_found",
                message: "Instância não encontrada. Crie uma nova instância."
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error("Failed to get status");
        }

        const result = await response.json();
        console.log("Connection state result:", result);

        const isConnected = result?.instance?.state === "open" || result?.state === "open";
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            configured: true,
            connected: isConnected,
            status: result?.instance?.state || result?.state || "unknown",
            instanceName: instanceName
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error("Error getting status:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            configured: true,
            connected: false,
            status: "error",
            error: error.message
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create instance
    if (action === "create") {
      try {
        const response = await fetch(`${evolutionApiUrl}/instance/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": evolutionApiKey,
          },
          body: JSON.stringify({
            instanceName: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          }),
        });

        const result = await response.json();
        console.log("Create instance result:", result);

        if (!response.ok) {
          // Check if instance already exists
          if (result.message?.includes("already") || result.error?.includes("already")) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: "Instância já existe",
                instanceName: instanceName
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error(result.message || "Failed to create instance");
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Instância criada com sucesso",
            instanceName: instanceName,
            qrcode: result.qrcode
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error("Error creating instance:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get QR Code
    if (action === "qrcode") {
      try {
        const response = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: {
            "apikey": evolutionApiKey,
          },
        });

        const result = await response.json();
        console.log("QR Code result:", result);

        if (!response.ok) {
          throw new Error(result.message || "Failed to get QR code");
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            qrcode: result.base64 || result.qrcode?.base64 || result.code,
            pairingCode: result.pairingCode
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error("Error getting QR code:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Disconnect/Logout
    if (action === "disconnect") {
      try {
        const response = await fetch(`${evolutionApiUrl}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: {
            "apikey": evolutionApiKey,
          },
        });

        const result = await response.json();
        console.log("Disconnect result:", result);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "WhatsApp desconectado com sucesso"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: any) {
        console.error("Error disconnecting:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in whatsapp-connection:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
