import Stripe from "https://esm.sh/stripe@14?target=deno";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { plan = "pro", billing = "monthly" } = await req.json();
    const priceId = PRICES[`${plan}_${billing}`] || PRICES.pro_monthly;

    if (!priceId) {
      return Response.json({ error: `Prix non configuré pour ${plan}_${billing}` }, { status: 400, headers: CORS });
    }

    const appUrl = Deno.env.get("APP_URL") || "https://wealthtrack-app1.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      success_url: `${appUrl}/?payment=success&plan=${plan}`,
      cancel_url:  `${appUrl}/?view=pricing`,
    });

    return Response.json({ success: true, url: session.url }, { headers: CORS });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
});
