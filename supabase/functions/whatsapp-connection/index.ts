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
    let uazapiUrl = Deno.env.get("UAZAPI_URL");
    const uazapiToken = Deno.env.get("UAZAPI_TOKEN");
    const uazapiAdminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN");

    if (!uazapiUrl || !uazapiToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "uazapi not configured",
          configured: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    uazapiUrl = uazapiUrl.replace(/\/+$/, "");

    const { action } = await req.json();
    const instanceName = "EspacoEssentia";

    const authHeaders = {
      "Content-Type": "application/json",
      token: uazapiToken,
    } as Record<string, string>;

    // Get connection status
    if (action === "status") {
      try {
        const response = await fetch(`${uazapiUrl}/instance/status`, {
          method: "GET",
          headers: authHeaders,
        });

        const result = await response.json();
        console.log("Connection state result:", result);

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              configured: true,
              connected: false,
              status: "error",
              error: result?.message || "Failed to get status",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const state =
          result?.instance?.status || result?.status || (result?.connected ? "connected" : "disconnected");
        const isConnected = state === "connected" || result?.connected === true;

        return new Response(
          JSON.stringify({
            success: true,
            configured: true,
            connected: isConnected,
            status: state,
            instanceName,
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
            error: error.message,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create instance (requires admin token)
    if (action === "create") {
      if (!uazapiAdminToken) {
        return new Response(
          JSON.stringify({ success: false, error: "UAZAPI_ADMIN_TOKEN não configurado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      try {
        const response = await fetch(`${uazapiUrl}/instance/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            admintoken: uazapiAdminToken,
          },
          body: JSON.stringify({ name: instanceName, systemName: instanceName }),
        });

        const result = await response.json();
        console.log("Create instance result:", result);

        if (!response.ok) {
          throw new Error(result.message || result.error || "Failed to create instance");
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "Instância criada com sucesso",
            instanceName,
            token: result.token || result?.instance?.token,
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
        const response = await fetch(`${uazapiUrl}/instance/connect`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({}),
        });

        const result = await response.json();
        console.log("QR Code result:", result);

        if (!response.ok) {
          throw new Error(result.message || "Failed to get QR code");
        }

        const qr =
          result?.instance?.qrcode ||
          result?.qrcode ||
          result?.base64 ||
          result?.qrcode?.base64;
        const pairingCode = result?.instance?.paircode || result?.paircode || result?.pairingCode;

        return new Response(
          JSON.stringify({
            success: true,
            qrcode: qr,
            pairingCode,
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
        const response = await fetch(`${uazapiUrl}/instance/disconnect`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({}),
        });

        const result = await response.json().catch(() => ({}));
        console.log("Disconnect result:", result);

        return new Response(
          JSON.stringify({
            success: response.ok,
            message: response.ok ? "WhatsApp desconectado com sucesso" : (result?.message || "Falha ao desconectar"),
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
