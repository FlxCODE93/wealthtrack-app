// ════════════════════════════════════════════════════════════════════
// stripe-checkout — crée une session Stripe Checkout liée à l'utilisateur.
//
// SÉCURITÉ : l'identité vient du JWT Supabase (header Authorization), JAMAIS
// du corps de la requête. On attache user_id à la session ET à l'abonnement
// (metadata) pour que le webhook puisse écrire le plan sur la bonne ligne.
// ════════════════════════════════════════════════════════════════════
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const PRICES: Record<string, string | undefined> = {
  pro_monthly:    Deno.env.get("STRIPE_PRICE_ID"),
  pro_annual:     Deno.env.get("STRIPE_PRICE_PRO_ANNUAL"),
  couple_monthly: Deno.env.get("STRIPE_PRICE_COUPLE_MONTHLY"),
  couple_annual:  Deno.env.get("STRIPE_PRICE_COUPLE_ANNUAL"),
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Client admin (service_role) — relit l'éventuel customer_id existant.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── 1. Authentifier via le JWT (jamais le body) ─────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!jwt) {
      return Response.json({ error: "Authentification requise." }, { status: 401, headers: CORS });
    }
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !user) {
      return Response.json({ error: "Session invalide." }, { status: 401, headers: CORS });
    }

    // ── 2. Résoudre le prix demandé ─────────────────────────────────────
    const { plan = "pro", billing = "monthly" } = await req.json();
    if (plan !== "pro" && plan !== "couple") {
      return Response.json({ error: "Plan invalide." }, { status: 400, headers: CORS });
    }
    const priceId = PRICES[`${plan}_${billing}`];
    if (!priceId) {
      return Response.json({ error: `Prix non configuré pour ${plan}_${billing}` }, { status: 400, headers: CORS });
    }

    // ── 3. Réutiliser le customer Stripe existant si on en a un ─────────
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const customerId = existing?.stripe_customer_id || undefined;

    const appUrl = Deno.env.get("APP_URL") || "https://wealthtrack-app1.vercel.app";

    // ── 4. Créer la session, en gravant user_id partout ─────────────────
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      ...(customerId ? { customer: customerId } : { customer_email: user.email }),
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: user.id, plan },
      },
      metadata: { user_id: user.id, plan },
      // success_url ne transporte plus le plan comme une vérité : le front
      // re-lit le plan depuis la DB. On garde juste un drapeau d'UX.
      success_url: `${appUrl}/?payment=success`,
      cancel_url:  `${appUrl}/?view=pricing`,
    });

    return Response.json({ success: true, url: session.url }, { headers: CORS });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500, headers: CORS });
  }
});
