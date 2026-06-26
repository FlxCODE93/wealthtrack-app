/* Logique pure du mode Couple — sans React ni Supabase, donc testable seule. */

/** Normalise un email pour comparaison (trim + minuscules). */
function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/**
 * État d'un lien de couple du point de vue de l'utilisateur courant.
 * @returns 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' | 'declined'
 */
export function coupleLinkState(link, userId, email) {
  if (!link) return "none";
  const myEmail = normEmail(email);
  const isRequester = link.requester_id === userId;
  const isPartnerById = link.partner_id === userId;
  const targetsMyEmail = normEmail(link.partner_email) === myEmail;

  if (link.status === "accepted") {
    // partner_id est normalement résolu à l'acceptation ; on tolère aussi le
    // match par email par robustesse (cohérent avec la branche pending).
    return isRequester || isPartnerById || targetsMyEmail ? "accepted" : "none";
  }
  if (link.status === "declined") {
    // Volontaire : seul le requester voit l'état refusé (il peut ré-inviter).
    return isRequester ? "declined" : "none";
  }
  // pending
  if (isRequester) return "pending_outgoing";
  if (isPartnerById || targetsMyEmail) return "pending_incoming";
  return "none";
}

/** Somme des `.value` de tous les items d'une liste de catégories. */
function sumItems(categories) {
  return (categories || [])
    .flatMap((c) => c.items || [])
    .reduce((s, i) => s + (Number(i.value) || 0), 0);
}

/** Blob minimal partagé avec le partenaire (totaux uniquement, pas le détail). */
export function shareFromPatrimoine(patrimoine, profile, monthly) {
  const actifs  = sumItems(patrimoine?.actifs);
  const passifs = sumItems(patrimoine?.passifs);
  return {
    firstName: (profile && profile.firstName) || "",
    netWorth: actifs - passifs,
    monthly: Number(monthly) || 0,
  };
}
