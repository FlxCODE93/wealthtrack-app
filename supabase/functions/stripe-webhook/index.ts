// ════════════════════════════════════════════════════════════════════
// stripe-webhook — UNIQUE source d'écriture du plan payant.
//
// Vérifie la signature Stripe (anti-forge), puis met à jour la table
// `subscriptions` via service_role. Le client ne peut jamais écrire ici.
//
// Secrets requis (supabase secrets set …) :
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sont injectés par le runtime)
//
// IMPORTANT côté config : cette fonction doit être déployée SANS vérif JWT
// (Stripe n'envoie pas de JWT) → `supabase functions deploy stripe-webhook
//  --no-verify-jwt`.
// ════════════════════════════════════════════════════════════════════
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Prix → plan (inverse de la map du checkout).
function planForPrice(priceId: string | undefined): "pro" | "couple" | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get("STRIPE_PRICE_ID") ||
      priceId === Deno.env.get("STRIPE_PRICE_PRO_ANNUAL")) return "pro";
  if (priceId === Deno.env.get("STRIPE_PRICE_COUPLE_MONTHLY") ||
      priceId === Deno.env.get("STRIPE_PRICE_COUPLE_ANNUAL")) return "couple";
  return null;
}

// Statuts Stripe qui donnent accès au plan payant.
const ACTIVE = new Set(["active", "trialing", "past_due"]);

async function upsert(row: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("[webhook] upsert error:", error.message);
}

// Écrit l'état d'un abonnement Stripe sur la ligne du user.
async function syncSubscription(sub: Stripe.Subscription, userIdHint?: string) {
  const userId = userIdHint || (sub.metadata?.user_id as string | undefined);
  if (!userId) { console.error("[webhook] user_id introuvable sur sub", sub.id); return; }

  const priceId = sub.items.data[0]?.price?.id;
  const paidPlan = planForPrice(priceId);
  const active = ACTIVE.has(sub.status);

  await upsert({
    user_id: userId,
    // Pas d'accès payant → on retombe sur 'free' (gate effectif).
    plan: active && paidPlan ? paidPlan : "free",
    status: sub.status,
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
  });
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text(); // corps BRUT obligatoire pour la signature
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook] Signature invalide:", (err as Error).message);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ||
                       (session.metadata?.user_id as string | undefined);
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscription(sub, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[webhook] handler error:", (err as Error).message);
    // On renvoie 200 quand même pour éviter les retries en boucle sur erreur
    // applicative non récupérable ; les erreurs DB sont déjà loggées.
  }

  return Response.json({ received: true });
});
