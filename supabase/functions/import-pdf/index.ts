/* ────────────────────────────────────────────────────────────────────
   Edge Function : import-pdf
   Reçoit un relevé bancaire PDF (multipart form-data, champ "file"),
   extrait le texte avec unpdf (pdfjs-dist edge-compatible),
   structure les transactions via Claude Haiku, retourne JSON.

   Secrets requis dans Supabase Dashboard → Settings → Edge Functions :
     ANTHROPIC_API_KEY
     SUPABASE_URL  (auto-injectée par Supabase)
     SUPABASE_ANON_KEY (auto-injectée)
     SUPABASE_SERVICE_ROLE_KEY
   ──────────────────────────────────────────────────────────────────── */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText } from "npm:unpdf@0.11.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  // ── Auth : vérifier JWT Supabase ──────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return json({ success: false, error: "Non authentifié." }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ success: false, error: "Token invalide." }, 401);

  // ── Plan check : Pro ou Couple requis ────────────────────────────
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasPro = sub && ["active", "trialing", "past_due"].includes(sub.status)
    && ["pro", "couple"].includes(sub.plan);
  if (!hasPro) return json({ success: false, error: "L'import PDF est réservé au plan Pro." }, 403);

  // ── Extraction du fichier PDF ─────────────────────────────────────
  let pdfBuffer: Uint8Array;
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return json({ success: false, error: "Aucun fichier reçu." }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ success: false, error: "PDF trop grand (max 5 Mo)." }, 413);
    pdfBuffer = new Uint8Array(await file.arrayBuffer());
  } catch {
    return json({ success: false, error: "Impossible de lire le fichier envoyé." }, 400);
  }

  // ── Extraction du texte via unpdf ────────────────────────────────
  let pdfText: string;
  try {
    const { text } = await extractText(pdfBuffer, { mergePages: true });
    pdfText = text?.trim() ?? "";
  } catch {
    return json({ success: false, error: "PDF illisible ou corrompu." }, 422);
  }

  if (!pdfText) {
    return json({
      success: false,
      error: "Aucun texte trouvé dans le PDF. Vérifiez que ce n'est pas un relevé scanné (image).",
    }, 422);
  }

  // ── Structuration via Claude Haiku ───────────────────────────────
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ success: false, error: "Service IA non configuré." }, 503);

  const clipped = pdfText.slice(0, 14000);

  let transactions: { date: string; description: string; amount: number }[];
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: `Voici le texte brut d'un relevé bancaire français extrait d'un PDF. Extrais TOUTES les transactions.\n\nRéponds UNIQUEMENT avec un tableau JSON valide (sans Markdown, sans texte autour) : [{\"date\":\"YYYY-MM-DD\",\"description\":\"libellé\",\"amount\":nombre}].\nRègles : amount NÉGATIF pour un débit/retrait/paiement, POSITIF pour un crédit/virement reçu/dépôt. Ne pas inventer de transactions.\n\n---DÉBUT RELEVÉ---\n${clipped}\n---FIN RELEVÉ---`,
        }],
      }),
    });

    if (!aiRes.ok) throw new Error(`Claude API ${aiRes.status}`);
    const aiData = await aiRes.json();
    const raw = (aiData.content?.[0]?.text ?? "").trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Format inattendu de la réponse IA.");
    transactions = JSON.parse(match[0]);
    if (!Array.isArray(transactions)) throw new Error("Résultat non tableau.");
  } catch (e) {
    return json({ success: false, error: `Extraction IA échouée : ${e.message}` }, 500);
  }

  if (!transactions.length) {
    return json({ success: false, error: "Aucune transaction détectée dans ce relevé." }, 422);
  }

  return json({ success: true, transactions });
});
