/**
 * WealthTrack — Assistant financier v2
 * 16 sujets : PEA, AV, crypto, PER, livrets, IR, SCPI, DCA, PTZ, notaire, FIRE…
 * Extraction automatique des montants depuis les questions.
 */
import React, { useState } from "react";
import { Info, AlertTriangle, CheckCircle2, PartyPopper, Wallet } from "lucide-react";
import { C, eur } from "./theme.js";
import { fvMonthly, loanCap, RATE_A, RATE_C, RATE_BTC, RATE_ETH } from "./finance.js";

/* ─── Utilitaires ──────────────────────────────────────────────────── */
function fv(m, r, y) {
  return Math.round(fvMonthly(m, r, y));
}
function yearsToFIRE(nw, m, tgt, r = RATE_A) {
  if (m <= 0 || tgt <= 0) return null;
  const mr = r / 12;
  if (nw >= tgt) return 0;
  const x = (tgt + m / mr) / (Math.max(nw, 0) + m / mr);
  if (x <= 1) return 0;
  return Math.log(x) / Math.log(1 + mr) / 12;
}

/* Extrait montant €, durée, année cible, enveloppe et actif d'un texte libre */
function extractParams(text) {
  const am = text.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:€|euros?)\b/i);
  const amount = am ? parseFloat(am[1].replace(/\s/g, "").replace(",", ".")) : null;
  const ym = text.match(/(\d+)\s*ans/i);
  const years = ym ? parseInt(ym[1]) : null;
  const mm = text.match(/(\d+)\s*(?:€)?\s*(?:\/mois|par mois)/i);
  const monthly = mm ? parseFloat(mm[1]) : null;
  // Année cible (ex: 2039, 2045)
  const tym = text.match(/\b(20[2-9]\d)\b/);
  const targetYear = tym ? parseInt(tym[1]) : null;
  // Enveloppe
  const isPEA = /\bpea\b/i.test(text);
  const isAV  = /assurance.?vie|\bav\b/i.test(text);
  const isCTO = /compte.?titres|\bcto\b/i.test(text);
  // Actif et taux de rendement
  let rate = RATE_A, assetName = "ETF World";
  if (/msci|world|etf|iwda|cw8|wpea/i.test(text) && !/livret/i.test(text)) { rate = RATE_A; assetName = "MSCI World"; }
  if (/bitcoin|\bbtc\b/i.test(text))           { rate = RATE_BTC; assetName = "Bitcoin"; }
  if (/ethereum|\beth\b/i.test(text))          { rate = RATE_ETH; assetName = "Ethereum"; }
  if (/livret.?a\b|ldds/i.test(text))          { rate = RATE_C; assetName = "Livret A"; }
  if (/oblig|bond|fonds?.*euro/i.test(text) && !/msci|world|etf/i.test(text)) { rate = 0.035; assetName = "Fonds euro"; }
  return { amount, years, monthly, targetYear, isPEA, isAV, isCTO, rate, assetName };
}

/* ─── Base de connaissances ────────────────────────────────────────── */

function mkRepayFaster(ctx, params) {
  const { totals } = ctx;
  const surplus = Math.max(0, Math.round((totals.revenus || 0) - (totals.chargesFixes || 0) - (totals.depensesVar || 0) - (totals.invest || 0)));
  return {
    intro: "Pour solder vos crédits plus vite : augmentez la part qui rembourse le capital, et attaquez d'abord le crédit le plus cher.",
    table: [
      ["Levier", "Effet"],
      ["Méthode avalanche", "Cibler le TAEG le plus élevé d'abord = max d'intérêts économisés"],
      ["Mensualités arrondies", "Arrondir à la centaine supérieure raccourcit la durée sans douleur"],
      ["Remboursement anticipé partiel", "Prime, 13e mois ou rentrée d'argent versée directement sur le capital"],
      ["Renégociation / rachat", "Si votre taux dépasse le marché, regrouper peut baisser le coût total"],
    ],
    bullets: [
      "Attaquez d'abord le crédit au **taux le plus élevé** (conso et revolving avant l'immobilier).",
      "Vérifiez les **IRA** (indemnités de remboursement anticipé) : pour un prêt immo, plafonnées à 6 mois d'intérêts et 3 % du capital restant dû.",
      "Gardez votre **épargne de précaution** (3 à 6 mois de dépenses) avant d'accélérer le remboursement.",
      "Crédit immo à **moins de 3,5 %** : placer le surplus est souvent plus rentable que rembourser — comparez avec l'outil « Rembourser ou investir ? ».",
    ],
    note: surplus > 0
      ? `Votre surplus actuel (~${eur(surplus)}/mois) appliqué en remboursement anticipé réduit fortement la durée et les intérêts totaux.`
      : "Dégagez d'abord un surplus mensuel (réduction des dépenses) pour pouvoir accélérer le remboursement.",
    chips: ["Rembourser ou investir ?", "Réduire mes dépenses", "Capacité d'emprunt"],
  };
}

function mkBorrowing(ctx, params) {
  const { totals } = ctx;
  const mMax  = Math.round(totals.revenus * 0.35);
  const cap20 = loanCap(mMax, 0.035, 20);
  const cap25 = loanCap(mMax, 0.037, 25);
  return {
    intro: `Avec ${eur(totals.revenus)}/mois de revenus, voici ce que les banques vous prêteront (règle des 35 % d'endettement) :`,
    table: [
      ["", "Montant"],
      ["Mensualité maximum (35 %)", `${eur(mMax)}/mois`],
      ["Capacité sur 20 ans (3,5 %)", eur(cap20)],
      ["Capacité sur 25 ans (3,7 %)", eur(cap25)],
      ["Apport minimum conseillé (10 %)", eur(Math.round(cap20 * 0.10))],
    ],
    bullets: [
      "La règle des **35 %** inclut tous vos crédits en cours (auto, conso, immo).",
      "Les banques regardent aussi : stabilité de l'emploi, reste à vivre, historique bancaire.",
      "Les frais de notaire (~8 % dans l'ancien) doivent faire partie de votre apport.",
    ],
    note: "Ces chiffres sont des estimations. Un courtier gratuit (CAFPI, Meilleurtaux) optimisera votre dossier.",
    chips: ["Frais de notaire", "PTZ primo-accédant", "PFU vs PEA"],
  };
}

function mkPFUvsPEA(ctx, params) {
  const monthly = params.monthly || ctx.simParams?.monthly || 200;
  const gain20  = fv(monthly, RATE_A, 20) - monthly * 12 * 20;
  const taxPFU  = Math.round(gain20 * 0.30);
  return {
    intro: `Avec ${eur(monthly)}/mois sur 20 ans, le PEA vous économise ${eur(taxPFU)} d'impôts par rapport à un compte-titres ordinaire.`,
    table: [
      ["",                  "Compte-titres (PFU)", "PEA"],
      ["Imposition gains",  "30 % flat tax",       "0 % après 5 ans"],
      ["Plafond versements","Illimité",             "150 000 €"],
      ["Actifs éligibles",  "Tous",                "Actions UE / ETF éligibles"],
      ["Retrait",           "Libre",               "Libre après 5 ans"],
      ["Impôt sur 20 ans",  eur(taxPFU),           "0 €"],
    ],
    bullets: [
      "Ouvrez un PEA **aujourd'hui même avec 1 €** — les 5 ans commencent à l'ouverture du compte.",
      "Comparez les frais de courtage et de tenue de compte avant d'ouvrir — de nombreuses offres sans frais existent aujourd'hui.",
      "ETF éligibles PEA : **CW8** (Amundi MSCI World, 0,12 %/an), **WPEA** (Lyxor, 0,25 %/an).",
    ],
    note: "Si vous clôturez le PEA avant 5 ans, les gains sont taxés à 30 % — évitez à tout prix de fermer prématurément.",
    chips: ["PEA avant 5 ans — fiscalité ?", "Comment ouvrir un PEA ?", "ETF vs fonds actifs"],
  };
}

function mkPEAClotureAvant5Ans(ctx, params) {
  const montant = params.amount || ctx.simParams?.monthly * 12 || 5000;
  const g2 = Math.round(montant * (Math.pow(1 + RATE_A, 2) - 1));
  const g3 = Math.round(montant * (Math.pow(1 + RATE_A, 3) - 1));
  const t2 = Math.round(g2 * 0.30);
  const t3 = Math.round(g3 * 0.30);
  return {
    intro: `Votre versement de ${eur(montant)} n'est jamais imposé — seuls les gains le sont. Si vous clôturez avant 5 ans, ces gains sont taxés à 30 % (PFU).`,
    table: [
      ["Scénario", "Gain estimé", "Impôt dû (30 %)"],
      ["Aucune plus-value",                                     "0 €",    "0 €"],
      [`Clôture après 2 ans (~${Math.round((Math.pow(1 + RATE_A,2)-1)*100)} %)`, `+${eur(g2)}`, eur(t2)],
      [`Clôture après 3 ans (~${Math.round((Math.pow(1 + RATE_A,3)-1)*100)} %)`, `+${eur(g3)}`, eur(t3)],
      ["Après 5 ans",                                           "Exonéré d'IR", "17,2 % PS seulement"],
    ],
    bullets: [
      `Vos ${eur(montant)} de capital versé ne sont **jamais imposés** — seule la plus-value l'est.`,
      "Clôturer avant 5 ans = **perdre définitivement le PEA** + impossible d'en rouvrir un pendant 5 ans.",
      "Si votre PEA est en perte à la clôture : **aucun impôt**, et la moins-value est déductible de vos autres gains de capitaux.",
      "Après 5 ans : seuls 17,2 % de prélèvements sociaux s'appliquent — l'impôt sur le revenu est exonéré.",
    ],
    note: "Conseil : si vous pensez avoir besoin de cet argent avant 5 ans, utilisez plutôt un compte-titres ou une assurance-vie — vous éviterez la clôture forcée.",
    chips: ["Comment ouvrir un PEA ?", "PFU vs PEA", "Assurance-vie"],
  };
}

function mkSavings(ctx, params) {
  const { totals } = ctx;
  const current = totals.invest;
  const target  = Math.round(totals.revenus * 0.20);
  const gap     = Math.max(0, target - current);
  const fv10    = fv(current, RATE_A, 10);
  const fv10t   = fv(current + gap, RATE_A, 10);
  return {
    intro: `Vous épargnez ${eur(current)}/mois (${((current / Math.max(totals.revenus, 1)) * 100).toFixed(1)} % de vos revenus). L'objectif recommandé est 20 %.`,
    table: [
      ["Indicateur", "Valeur"],
      ["Épargne actuelle",            `${eur(current)}/mois`],
      ["Objectif 20 % des revenus",   `${eur(target)}/mois`],
      ["Effort à trouver",            gap > 0 ? `${eur(gap)}/mois` : "Objectif atteint ✓"],
      ["Capital en 10 ans (actuel)",  eur(fv10)],
      ["Capital en 10 ans (cible)",   eur(fv10t)],
      ["Gain supplémentaire",         `+${eur(fv10t - fv10)}`],
    ],
    bullets: [
      "**Règle 50/30/20** : 50 % besoins, 30 % envies, 20 % épargne.",
      "100 €/mois supplémentaires investis sur 20 ans = +100 000 € de capital (intérêts composés).",
      "Automatisez le virement épargne dès réception du salaire — avant de pouvoir dépenser.",
    ],
    note: "Ordre : Livret A (urgences) → PEA (long terme) → Assurance-vie (diversification).",
    chips: ["Fonds d'urgence", "PEA vs PFU", "DCA - Investir chaque mois"],
  };
}

function mkTiming() {
  return {
    intro: "Le meilleur moment pour investir, c'est maintenant. Les données sur 50 ans sont sans appel :",
    bullets: [
      "Le **MSCI World** progresse en moyenne +10,5 %/an sur 50 ans, malgré toutes les crises.",
      "Rater les **10 meilleures journées boursières** d'une décennie divise les gains par 2.",
      "Un investisseur qui attendait « la prochaine crise » depuis 2010 a raté +400 % de hausse.",
      "Le **DCA** (investir chaque mois) élimine le besoin de trouver le bon moment.",
    ],
    table: [
      ["Horizon", "Risque", "Stratégie conseillée"],
      ["< 3 ans",  "Faible", "Livret A, LDDS, fonds monétaires"],
      ["3–8 ans",  "Modéré", "Mix ETF obligataires + actions, AV"],
      ["> 8 ans",  "Élevé",  "100 % ETF MSCI World (IWDA, CW8, WPEA)"],
    ],
    chips: ["DCA - Investir chaque mois", "ETF vs fonds actifs", "Allocation idéale"],
  };
}

function mkAllocation() {
  return {
    intro: "Votre allocation dépend de votre horizon et de votre tolérance à voir votre portefeuille baisser temporairement :",
    quiz: [
      {
        question: "Dans combien d'années avez-vous besoin de cet argent ?",
        options: [
          { label: "< 3 ans",  portfolio: "70 % Livret A/LDDS · 20 % obligations · 10 % actions ETF" },
          { label: "3–8 ans",  portfolio: "30 % fonds euros AV · 30 % ETF obligataire · 40 % ETF actions" },
          { label: "> 8 ans",  portfolio: "0 % monétaire · 10 % obligations · 90 % ETF MSCI World" },
        ],
      },
    ],
    bullets: [
      "Un ETF **MSCI World** couvre 1 500+ entreprises dans 23 pays en un seul produit.",
      "Règle simple : votre % en actions ≈ 110 − votre âge. Ex : 35 ans → 75 % actions.",
    ],
    note: "Un ETF MSCI World (ex. CW8, IWDA) suffit pour la majorité des investisseurs long terme.",
    chips: ["ETF vs fonds actifs", "Comment ouvrir un PEA ?", "DCA - Investir chaque mois"],
  };
}

function mkFIRE(ctx, params) {
  const { totals, patrimoine } = ctx;
  const annualExp = (totals.chargesFixes + totals.depensesVar) * 12;
  const fireNum   = Math.round(annualExp * 25);
  const currentNW = (patrimoine?.actifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0)
                  - (patrimoine?.passifs || []).flatMap(c => c.items).reduce((s, i) => s + i.value, 0);
  const yrs       = yearsToFIRE(currentNW, totals.invest, fireNum);
  const progress  = Math.min(100, Math.round((currentNW / Math.max(fireNum, 1)) * 100));
  return {
    intro: "Votre indépendance financière (FIRE) en chiffres réels, calculée sur vos données :",
    table: [
      ["Indicateur", "Valeur"],
      ["Dépenses annuelles",         eur(annualExp)],
      ["Nombre FIRE (règle 25×)",    eur(fireNum)],
      ["Patrimoine net actuel",      eur(currentNW)],
      ["Progression vers FIRE",      `${progress} %`],
      ["Épargne mensuelle",          eur(totals.invest)],
      ["Années restantes estimées",  yrs == null ? "— (augmentez l'épargne)" : yrs < 0.5 ? "< 1 an 🎉" : `${yrs.toFixed(1)} ans`],
    ],
    bullets: [
      "**Règle des 4 %** : retirer 4 % de votre patrimoine par an ne l'épuise jamais sur 30 ans.",
      "**Règle des 25×** : dépenses annuelles × 25 = votre objectif FIRE.",
      "**Coast FIRE** : si votre patrimoine actuel suffit à croître seul jusqu'à FIRE sans épargner davantage.",
    ],
    note: `Chaque ${eur(200)}/mois supplémentaires raccourcit votre horizon de plusieurs années grâce aux intérêts composés.`,
    chips: ["Comment épargner plus ?", "PFU vs PEA", "DCA - Investir chaque mois"],
  };
}

function mkPEASteps() {
  return {
    intro: "Ouvrir un PEA prend 15 minutes en ligne. C'est la meilleure décision fiscale pour un investisseur long terme :",
    steps: [
      "Comparer les offres et choisir une formule sans frais de tenue de compte ni de courtage.",
      "Ouvrir le PEA en ligne — carte d'identité + RIB suffisent.",
      "Verser un premier montant même symbolique (1 €) pour **prendre date** — les 5 ans commencent maintenant.",
      "Programmer un virement automatique mensuel depuis votre compte courant.",
      "Acheter un ETF éligible PEA : **CW8** (Amundi MSCI World) ou **WPEA** (Lyxor/Amundi).",
    ],
    note: "Plafond PEA : 150 000 € de versements. PEA-PME : 225 000 € supplémentaires pour PME européennes.",
    chips: ["PFU vs PEA", "ETF vs fonds actifs", "DCA - Investir chaque mois"],
  };
}

function mkLivrets(ctx, params) {
  const montant  = params.amount || Math.round((ctx.totals?.invest || 200) * 12);
  const gainA    = Math.round(Math.min(montant, 22950) * 0.015);
  const gainLEP  = Math.round(Math.min(montant, 10000) * 0.035);
  return {
    intro: "Les livrets réglementés sont la base de toute épargne : sécurisés, disponibles immédiatement, exonérés d'impôts.",
    table: [
      ["Livret", "Taux 2025", "Plafond", "Impôts"],
      ["Livret A",      "1,5 %/an", "22 950 €",  "Exonéré"],
      ["LDDS",          "1,5 %/an", "12 000 €",  "Exonéré"],
      ["LEP",           "3,5 %/an", "10 000 €",  "Exonéré (conditions ressources)"],
      ["Livret bancaire", "Variable (< 1 %)", "Illimité", "PFU 30 %"],
    ],
    bullets: [
      montant > 0 ? `Sur ${eur(montant)} en Livret A : gain ≈ **${eur(gainA)}/an** nets, sans aucun impôt.` : "",
      `Le **LEP** (3,5 %/an) est le meilleur rendement sans risque — vérifiez votre éligibilité selon vos revenus.`,
      "Remplissez d'abord le Livret A, puis le LDDS, avant de passer à d'autres placements.",
      "Ces livrets sont **parfaits pour le fonds d'urgence** — argent disponible en 24h.",
    ].filter(Boolean),
    note: "Le taux du Livret A (2,4 %) est révisé par la Banque de France chaque semestre.",
    chips: ["Fonds d'urgence", "PFU vs PEA", "Assurance-vie"],
  };
}

function mkAssuranceVie(ctx, params) {
  const monthly  = params.monthly || ctx.simParams?.monthly || 200;
  const gain8    = fv(monthly, 0.05, 8) - monthly * 12 * 8;
  const gainTax  = Math.max(0, gain8 - 4600);
  const impotAV  = Math.round(gainTax * (0.075 + 0.172));
  const impotPFU = Math.round(gain8 * 0.30);
  return {
    intro: "L'assurance-vie est le couteau suisse du patrimoine : flexible, peu fiscalisée après 8 ans, et puissante pour la succession.",
    table: [
      ["",                  "Avant 8 ans",               "Après 8 ans"],
      ["Impôt sur les gains", "PFU 30 %",               "7,5 % IR + 17,2 % PS"],
      ["Abattement annuel", "—",                         "4 600 € (célibataire) / 9 200 € (couple)"],
      ["Avantage succession", "152 500 €/bénéficiaire sans droits", "Idem"],
      ["Retrait partiel",   "Possible, imposé",           "Possible, très avantageux"],
    ],
    bullets: [
      `${eur(monthly)}/mois sur 8 ans → gain ≈ ${eur(gain8)}. Impôt : **${eur(impotAV)}** (après abattement) vs ${eur(impotPFU)} avant 8 ans.`,
      "Supports : **fonds euros** (capital garanti, ~2-3 %/an) + **unités de compte** (ETF, SCPI, actions).",
      "Pas de plafond de versements — complémentaire au PEA limité à 150 000 €.",
      "Un retrait partiel ne clôture **pas** le contrat — l'argent restant continue de fructifier.",
    ],
    note: "Ouvrez une AV dès maintenant même avec 100 € pour prendre date. Comparez les frais d'entrée, de gestion et le choix de supports avant de choisir un contrat.",
    chips: ["PEA vs PFU", "PER - Plan Épargne Retraite", "SCPI"],
  };
}

function mkCryptoFisc(ctx, params) {
  const gain  = params.amount || 5000;
  const impot = gain > 305 ? Math.round(gain * 0.30) : 0;
  return {
    intro: `En France, les cryptos sont imposées au PFU de 30 % (12,8 % IR + 17,2 % PS) dès que vos cessions annuelles dépassent 305 €.`,
    table: [
      ["Règle", "Détail"],
      ["Taux",                   "30 % (PFU) sur les plus-values nettes"],
      ["Seuil de déclenchement", "305 € de cessions annuelles totales"],
      ["Méthode légale",         "PMCA — méthode du portefeuille (Art. 150 VH bis CGI)"],
      ["Pertes reportables ?",   "Non — elles expirent au 31 décembre"],
      ["Wash sale",              "Pas de règle en France → revente/rachat immédiat légal"],
      ["Déclaration",            "Formulaire CERFA 2086"],
    ],
    bullets: [
      gain > 305
        ? `Sur ${eur(gain)} de gains nets : **impôt estimé = ${eur(impot)}** (à déclarer en mai N+1).`
        : `Cessions < 305 €/an → **aucun impôt** à déclarer.`,
      "**Échanges crypto-to-crypto** (BTC → ETH) : non imposables — seuls les échanges vers euros le sont.",
      "**Tax-loss harvesting** : vendre en moins-value pour effacer des gains — légal et très efficace avant le 31 décembre.",
      "**Staking** : revenus potentiellement traités comme BNC — consultez un expert-comptable.",
    ],
    note: "Utilisez la section Fiscalité Crypto de WealthTrack pour simuler vos gains, pertes et opportunités de tax-loss harvesting.",
    chips: ["Tax-loss harvesting", "PFU vs PEA", "Tranches d'impôts IR"],
  };
}

function mkTaxLossHarvesting() {
  return {
    intro: "Le tax-loss harvesting : vendre des actifs en moins-value pour compenser des gains imposables et économiser sur le PFU.",
    bullets: [
      "**Exemple** : +2 000 € de gains BTC + -1 500 € de pertes ETH latentes → vendez l'ETH → gain imposable = 500 € → vous économisez **450 € de PFU**.",
      "En France, **aucune règle anti-wash sale** : vendez et rachetez immédiatement pour maintenir votre exposition.",
      "**Délai impératif** : les pertes crypto expirent au 31 décembre — opérez avant la fin de l'année fiscale.",
      "Classez vos positions par moins-value décroissante et comblez vos gains dans l'ordre.",
    ],
    note: "WealthTrack calcule automatiquement vos opportunités de tax-loss harvesting dans la section Fiscalité Crypto.",
    chips: ["Fiscalité crypto", "PFU vs PEA", "Tranches d'impôts IR"],
  };
}

function mkPER(ctx, params) {
  const revenuAn  = (ctx.totals?.revenus || 3000) * 12;
  const deductMax = Math.round(Math.min(revenuAn * 0.10, 35194));
  const eco30     = Math.round(deductMax * 0.30);
  const eco41     = Math.round(deductMax * 0.41);
  return {
    intro: "Le PER (Plan d'Épargne Retraite) vous donne une déduction fiscale immédiate : vos versements réduisent directement votre revenu imposable.",
    table: [
      ["Caractéristique", "Détail"],
      ["Plafond déduction 2024",       `${eur(deductMax)}/an (10 % des revenus N-1)`],
      ["Économie si TMI 30 %",          `≈ ${eur(eco30)}/an récupérés`],
      ["Économie si TMI 41 %",          `≈ ${eur(eco41)}/an récupérés`],
      ["Imposition sortie retraite",   "IR barème sur capital + PFU 30 % sur gains"],
      ["Déblocage anticipé",           "Résidence principale, invalidité, fin droits chômage…"],
    ],
    bullets: [
      "**TMI < 11 %** : peu d'intérêt — préférez PEA ou assurance-vie.",
      "**TMI ≥ 30 %** : excellent — chaque 1 000 € versés = 300 € récupérés cette année.",
      "Option sans déduction à l'entrée : sortie du capital exonérée d'IR (seuls les gains sont imposés à PFU).",
      "Le PER est **bloqué jusqu'à la retraite** sauf cas de déblocage anticipé.",
    ],
    note: "Stratégie idéale : déduisez à 30-41 % maintenant et payez à 11 % (ou 0 %) à la retraite si votre revenu baisse.",
    chips: ["Tranches d'impôts IR", "Assurance-vie", "Mon FIRE / indépendance financière"],
  };
}

function mkEmergencyFund(ctx, params) {
  const monthly = (ctx.totals?.chargesFixes || 0) + (ctx.totals?.depensesVar || 0);
  const current = ctx.totals?.invest || 0;
  const stable = (ctx.profileType || "salarie_stable") === "salarie_stable";

  // CDI → cible 3 mois (revenu sécurisé). Revenus variables → cible 6-9 mois.
  const lowMonths  = stable ? 3 : 6;
  const highMonths = stable ? 6 : 9;
  const tLow  = Math.round(monthly * lowMonths);
  const tHigh = Math.round(monthly * highMonths);

  const bullets = [
    "**Toujours sur Livret A ou LDDS** : disponible en 24h, sans risque, sans impôts.",
    "Ne jamais investir ce capital en bourse — il doit être accessible immédiatement.",
    stable
      ? "En CDI, votre revenu est sécurisé : 3 mois suffisent, 6 mois pour plus de confort. Tout surplus va vers PEA ou assurance-vie."
      : "Vos revenus sont variables (freelance, intérim, indépendant) : visez 6 à 9 mois pour absorber les périodes creuses.",
  ];

  return {
    intro: stable
      ? "Le fonds d'urgence est votre filet de sécurité : il couvre vos dépenses en cas d'imprévu (perte d'emploi, gros pépin)."
      : "Le fonds d'urgence est votre filet de sécurité : avec des revenus variables, il doit couvrir des périodes sans rentrée d'argent.",
    table: [
      ["Objectif", "Cible", "Votre situation"],
      [`Minimum — ${lowMonths} mois de dépenses`,  eur(tLow),  current >= tLow  ? "Atteint ✓" : `Manque ${eur(Math.max(0, tLow - current))}`],
      [`Recommandé — ${highMonths} mois`,           eur(tHigh), current >= tHigh ? "Atteint ✓" : `Manque ${eur(Math.max(0, tHigh - current))}`],
    ],
    bullets,
    note: monthly > 0
      ? `Avec ${eur(monthly)}/mois de dépenses, vos cibles sont ${eur(tLow)} (${lowMonths} mois) et ${eur(tHigh)} (${highMonths} mois).`
      : "Renseignez vos dépenses dans Budget pour un calcul personnalisé.",
    chips: ["Livret A / Livrets", "Comment épargner plus ?", "Allocation idéale"],
  };
}

function mkETFvsActif() {
  const ma = 0.018, me = 0.002, base = 200, y = 20;
  const cA = fv(base, RATE_A - ma, y);
  const cE = fv(base, RATE_A - me, y);
  return {
    intro: "80 % des fonds gérés activement sous-performent leur indice sur 10 ans. La cause principale : leurs frais élevés.",
    table: [
      ["",                            "Fonds actif",            "ETF indiciel"],
      ["Frais annuels (TER)",         "1,5 — 2,5 %",           "0,1 — 0,3 %"],
      ["Surperformance long terme",   "< 20 % des cas",         "= indice − frais (garanti)"],
      [`Capital (${eur(base)}/mois, 20 ans)`, eur(cA),          eur(cE)],
      ["Différence de frais seuls",   "—",                      `+${eur(cE - cA)}`],
    ],
    bullets: [
      "1,5 % de frais en moins sur 20 ans = des dizaines de milliers d'euros de capital supplémentaire.",
      "ETF PEA recommandés : **CW8** (Amundi MSCI World, 0,12 %/an), **WPEA** (Lyxor, 0,25 %/an).",
      "Un seul ETF MSCI World = 1 500+ entreprises dans 23 pays — diversification maximale.",
      "Pas besoin d'analyser le marché, de choisir des actions ou de suivre l'actualité.",
    ],
    note: "Exception : certains fonds spécialisés (small caps, marchés émergents) peuvent justifier des frais plus élevés.",
    chips: ["Comment ouvrir un PEA ?", "DCA - Investir chaque mois", "Allocation idéale"],
  };
}

function mkIRTransches(ctx, params) {
  const revAn = params.amount || (ctx.totals?.revenus || 3000) * 12;
  let tmi = 0;
  if (revAn > 177106) tmi = 45;
  else if (revAn > 82341) tmi = 41;
  else if (revAn > 28797) tmi = 30;
  else if (revAn > 11294) tmi = 11;
  return {
    intro: `L'impôt sur le revenu est progressif : vous ne payez 30 % que sur la part de revenus au-dessus de 28 797 €, pas sur l'ensemble.`,
    table: [
      ["Tranche de revenus (1 part)", "Taux marginal"],
      ["Jusqu'à 11 294 €",           "0 %"],
      ["11 295 € – 28 797 €",        "11 %"],
      ["28 798 € – 82 341 €",        "30 %"],
      ["82 342 € – 177 106 €",       "41 %"],
      ["Au-delà de 177 106 €",       "45 %"],
    ],
    bullets: [
      revAn > 0 ? `Avec ${eur(revAn)}/an, votre **TMI est de ${tmi} %** — le taux appliqué sur votre dernier euro gagné.` : "",
      "Votre **taux moyen d'imposition** est toujours bien inférieur à votre TMI.",
      "**PER** : versements déductibles = réduction directe du revenu imposable, baisse potentielle de tranche.",
      "**Couple marié / pacsé** : doublez les seuils (2 parts = 2× les tranches).",
    ].filter(Boolean),
    note: `Barème 2024 pour 1 part fiscale. TMI estimée : ${tmi} % — utilisez-la pour évaluer l'intérêt d'un PER.`,
    chips: ["PER - Plan Épargne Retraite", "Assurance-vie", "PFU vs PEA"],
  };
}

function mkSCPI(ctx, params) {
  const montant  = params.amount || 20000;
  const gainBrut = Math.round(montant * 0.045);
  const gainNet  = Math.round(gainBrut * (1 - 0.30 - 0.172));
  return {
    intro: "Les SCPI permettent d'investir dans l'immobilier sans gérer de locataires — mais leur fiscalité est moins favorable qu'un PEA.",
    table: [
      ["Caractéristique", "Détail"],
      ["Rendement moyen 2024",      "4 — 5 %/an brut"],
      ["Imposition",                "Revenus fonciers : IR barème + 17,2 % PS"],
      [`Gain brut (${eur(montant)})`, `+${eur(gainBrut)}/an`],
      [`Gain net (TMI 30 %)`,         `+${eur(gainNet)}/an`],
      ["Ticket d'entrée",           "À partir de ~1 000 € en ligne"],
      ["Liquidité",                 "Faible — revente sous 1 à 6 mois"],
    ],
    bullets: [
      "**SCPI via assurance-vie** : fiscalité de l'AV (plus favorable après 8 ans) — solution recommandée.",
      "Risque 2023-2024 : hausse des taux + immobilier commercial sous pression → certaines SCPI ont baissé.",
      "Diversification : bureaux, commerces, logements, santé — selon la SCPI choisie.",
      "**Horizon minimum 8-10 ans** — les frais d'entrée (8-12 %) s'amortissent sur la durée.",
    ],
    note: "Privilégiez les SCPI à capital variable et vérifiez le taux d'occupation financier (TOF > 90 %).",
    chips: ["Assurance-vie", "Allocation idéale", "PFU vs PEA"],
  };
}

function mkDCA(ctx, params) {
  const monthly = params.monthly || ctx.simParams?.monthly || ctx.totals?.invest || 200;
  const years   = params.years || 20;
  const apport  = monthly * 12 * years;
  const total   = fv(monthly, RATE_A, years);
  return {
    intro: `Le DCA : investir ${eur(monthly)}/mois régulièrement, sans chercher à timer le marché. Simple et redoutablement efficace.`,
    table: [
      ["Durée", "Capital final", "Dont gains"],
      ["5 ans",  eur(fv(monthly,RATE_A,5)),  eur(fv(monthly,RATE_A,5)  - monthly*60)],
      ["10 ans", eur(fv(monthly,RATE_A,10)), eur(fv(monthly,RATE_A,10) - monthly*120)],
      ["20 ans", eur(total),               eur(total - apport)],
      ["30 ans", eur(fv(monthly,RATE_A,30)), eur(fv(monthly,RATE_A,30) - monthly*360)],
    ],
    bullets: [
      "En achetant chaque mois, vous profitez des baisses (plus d'unités au même prix) et des hausses.",
      "**Ne jamais stopper** en période de crise — c'est là que les meilleures unités sont achetées.",
      "Automatisez : virement mensuel vers PEA dès réception du salaire + ordre récurrent sur l'ETF.",
      "Même 50 €/mois à 10,5 %/an pendant 30 ans = plus de 100 000 € de capital.",
    ],
    note: "Rendement supposé de 10,5 %/an (moyenne MSCI World sur 50 ans). Les performances passées ne garantissent pas les futures.",
    chips: ["Bon moment pour investir ?", "ETF vs fonds actifs", "Comment ouvrir un PEA ?"],
  };
}

function mkPTZ(ctx, params) {
  const prix   = params.amount || 200000;
  const ptzMax = Math.round(prix * 0.40);
  const mMax   = Math.round((ctx.totals?.revenus || 2500) * 0.35);
  return {
    intro: "Le PTZ (Prêt à Taux Zéro) est un prêt sans intérêts accordé aux primo-accédants pour financer une résidence principale.",
    table: [
      ["Caractéristique", "Détail"],
      ["Taux",                 "0 % — aucun intérêt à rembourser"],
      [`Montant max (zone A/B1, ${eur(prix)})`, eur(ptzMax)],
      ["Quotité",              "40 % du prix en zone A/B1, 20 % en B2/C"],
      ["Qui est éligible ?",   "Primo-accédants, sous plafonds de revenus"],
      ["Remboursement",        "Différé 5-15 ans selon revenus, puis étalé sur 10-15 ans"],
    ],
    bullets: [
      "**Primo-accédant** = ne pas avoir été propriétaire de sa résidence principale dans les 2 dernières années.",
      "Le PTZ se **cumule** avec un prêt classique, un PEL, un prêt Action Logement.",
      "Zones : A/Abis (Paris, grandes agglos), B1 (villes moyennes), B2/C (reste de la France).",
      "Neuf et ancien avec travaux ≥ 25 % du coût total sont éligibles.",
    ],
    note: `Avec vos revenus, votre mensualité max est ~${eur(mMax)}/mois. Le PTZ réduit la part de prêt classique et donc cette mensualité.`,
    chips: ["Capacité d'emprunt", "Frais de notaire", "Bon moment pour acheter ?"],
  };
}

function mkNotaire(ctx, params) {
  const prix = params.amount || 200000;
  const fAn  = Math.round(prix * 0.08);
  const fNf  = Math.round(prix * 0.025);
  return {
    intro: `Les frais de notaire sont obligatoires lors d'un achat immobilier. Sur ${eur(prix)}, prévoyez ${eur(fNf)} (neuf) à ${eur(fAn)} (ancien).`,
    table: [
      ["Type de bien",     "% du prix", `Sur ${eur(prix)}`],
      ["Immobilier ancien (> 5 ans)", "7 — 8 %",  eur(fAn)],
      ["Neuf / VEFA",                 "2 — 3 %",  eur(fNf)],
    ],
    bullets: [
      "**Composition** : ~80 % droits de mutation (taxes État), ~10 % émoluments notaire, ~10 % débours.",
      "Ces frais sont **non négociables dans l'ancien** — fixés par l'État.",
      "**Astuce** : établissez un acte de vente de mobilier séparé (cuisine, armoires) — les meubles ne sont pas soumis aux droits de mutation.",
      "Les banques **ne financent généralement pas** les frais de notaire → ils doivent faire partie de votre apport.",
    ],
    note: "Utilisez la section Immobilier de WealthTrack pour simuler votre projet avec les frais de notaire intégrés.",
    chips: ["Capacité d'emprunt", "PTZ primo-accédant", "Fonds d'urgence"],
  };
}

function mkDefault() {
  return {
    intro: "Je suis votre assistant financier WealthTrack. Posez votre question en langage naturel, ou choisissez un sujet :",
    bullets: [
      "**Capacité d'emprunt** — calcul personnalisé avec la règle des 35 %",
      "**PFU vs PEA** — comparaison fiscale avec votre situation",
      "**PEA avant 5 ans** — impôts si vous clôturez prématurément",
      "**Livret A / LDDS / LEP** — taux, plafonds, stratégie",
      "**Assurance-vie** — fiscalité avant et après 8 ans",
      "**Fiscalité crypto** — PFU 30 %, PMCA, tax-loss harvesting",
      "**PER** — déduction fiscale et avantage selon votre TMI",
      "**Fonds d'urgence** — combien mettre de côté et où",
      "**ETF vs fonds actifs** — pourquoi les frais changent tout",
      "**Tranches d'impôts (IR)** — calcul de votre TMI",
      "**SCPI** — immobilier sans gestion, rendement et fiscalité",
      "**DCA** — investir chaque mois et l'effet des intérêts composés",
      "**PTZ** — prêt à taux zéro pour les primo-accédants",
      "**Frais de notaire** — calcul selon le type de bien",
      "**FIRE** — votre indépendance financière en chiffres réels",
    ],
    chips: ["PEA avant 5 ans — fiscalité ?", "Livret A / Livrets", "Fiscalité crypto", "Fonds d'urgence"],
  };
}

/* ─── Simulation chiffrée (montant + horizon ou année cible) ──────── */
function mkProjection(ctx, params) {
  const CURRENT_YEAR = 2026;
  const targetYear   = params.targetYear || (CURRENT_YEAR + (params.years || 20));
  const horizonYears = Math.max(1, targetYear - CURRENT_YEAR);
  const initAmount   = params.amount  || 0;
  const monthly      = params.monthly || 0;
  const rate         = params.rate;
  const assetName    = params.assetName;

  // Enveloppe : PEA par défaut pour ETF/actions si rien de précisé
  const isCrypto  = /bitcoin|ethereum/i.test(assetName);
  const isLivret  = /livret/i.test(assetName);
  const forcedPEA = !params.isPEA && !params.isAV && !params.isCTO && !isCrypto && !isLivret;
  const usePEA    = params.isPEA || forcedPEA;
  const useAV     = params.isAV;
  const wrapperLabel = usePEA ? "PEA" : useAV ? "Assurance-vie" : isCrypto ? "Compte-titres (crypto ≠ PEA)" : "Compte-titres";

  // Capital final
  let finalCapital = 0;
  if (initAmount > 0) finalCapital += Math.round(initAmount * Math.pow(1 + rate, horizonYears));
  if (monthly   > 0) finalCapital += fv(monthly, rate, horizonYears);
  const totalInvested = initAmount + monthly * 12 * horizonYears;
  const gain          = Math.max(0, finalCapital - totalInvested);

  // Fiscalité selon enveloppe et maturité
  let taxAmount, taxLabel, taxNote;
  if (isCrypto) {
    taxAmount = Math.round(gain * 0.30);
    taxLabel  = "PFU 30 % (crypto non éligible PEA)";
    taxNote   = "⚠ Les cryptomonnaies ne sont pas éligibles au PEA — PFU 30 % sur les gains nets.";
  } else if (isLivret) {
    taxAmount = 0;
    taxLabel  = "0 € (Livret A exonéré)";
    taxNote   = "Le Livret A est exonéré d'impôts et de prélèvements sociaux.";
  } else if (usePEA && horizonYears >= 5) {
    taxAmount = Math.round(gain * 0.172);
    taxLabel  = "17,2 % PS uniquement (PEA > 5 ans, IR exonéré)";
    taxNote   = `PEA de ${horizonYears} ans → exonération d'impôt sur le revenu. Seuls les prélèvements sociaux (17,2 %) s'appliquent.`;
  } else if (usePEA && horizonYears < 5) {
    taxAmount = Math.round(gain * 0.30);
    taxLabel  = "PFU 30 % (PEA < 5 ans)";
    taxNote   = `⚠ PEA de seulement ${horizonYears} an(s) → moins de 5 ans, PFU 30 %. Attendez ${CURRENT_YEAR + 5} pour l'exonération IR.`;
  } else if (useAV && horizonYears >= 8) {
    const taxable = Math.max(0, gain - 4600);
    taxAmount = Math.round(taxable * (0.075 + 0.172));
    taxLabel  = "AV après 8 ans (7,5 % + 17,2 % PS, abattement 4 600 €)";
    taxNote   = "Assurance-vie après 8 ans : abattement de 4 600 €/an, puis 7,5 % IR + 17,2 % PS sur le reste.";
  } else {
    taxAmount = Math.round(gain * 0.30);
    taxLabel  = "PFU 30 % (compte-titres)";
    taxNote   = "Compte-titres : PFU 30 % (12,8 % IR + 17,2 % PS) sur les gains nets.";
  }

  const netAfterTax = finalCapital - taxAmount;
  const mult        = (netAfterTax / Math.max(totalInvested, 1)).toFixed(1);

  // Économie vs CTO (si PEA)
  const taxCTO   = Math.round(gain * 0.30);
  const peaSaving = usePEA && horizonYears >= 5 ? taxCTO - taxAmount : 0;

  const introAmt = monthly > 0 && initAmount > 0
    ? `${eur(initAmount)} + ${eur(monthly)}/mois`
    : monthly > 0 ? `${eur(monthly)}/mois` : eur(initAmount);

  return {
    intro: `Simulation : **${introAmt}** sur **${assetName}** via **${wrapperLabel}** pendant **${horizonYears} ans** (jusqu'en ${targetYear}) :`,
    table: [
      ["", "Montant"],
      ["Capital investi",           eur(totalInvested)],
      ["Capital final estimé",      eur(finalCapital)],
      ["Gains bruts",               `+${eur(gain)}`],
      [taxLabel,                    taxAmount > 0 ? `-${eur(taxAmount)}` : "0 €"],
      ["💰 Net après impôts",       eur(netAfterTax)],
      ["Multiplicateur",            `×${mult} votre mise de départ`],
    ],
    bullets: [
      taxNote,
      peaSaving > 0
        ? `Par rapport à un compte-titres ordinaire (PFU 30 %), le PEA vous **économise ${eur(peaSaving)} d'impôts** sur ${horizonYears} ans.`
        : "",
      `Hypothèse : **${(rate * 100).toFixed(1)} %/an** en moyenne (rendement historique ${assetName} sur 50 ans).`,
      monthly === 0 && initAmount > 0
        ? `En ajoutant même 100 €/mois en plus, votre capital final passerait à ${eur(finalCapital + fv(100, rate, horizonYears))}.`
        : "",
    ].filter(Boolean),
    note: `Les marchés fluctuent : il peut y avoir des années à -20 %, compensées par d'autres à +25 %. N'investissez jamais des sommes dont vous auriez besoin avant ${horizonYears} ans.`,
    chips: [
      "DCA - Investir chaque mois",
      usePEA ? "Comment ouvrir un PEA ?" : "PFU vs PEA",
      "Allocation idéale",
    ],
  };
}

/* ─── Routeur ──────────────────────────────────────────────────────── */
const INTENTS = [
  { re: /tax.?loss|harvest|moins.?value.*comp|compens.*perte/i,                               fn: mkTaxLossHarvesting },
  { re: /livret.?a\b|ldds|lep\b|livret.*r[eé]glement|livret.*banc|taux.*livret/i,             fn: mkLivrets },
  { re: /assurance.?vie|\bav\b.*fiscal|8.{0,5}ans.*assurance|assurance.*8.{0,5}ans/i,         fn: mkAssuranceVie },
  { re: /crypto|bitcoin|eth(?:ereum)?\b|altcoin|nft|defi|fiscalit.*coin/i,                    fn: mkCryptoFisc },
  { re: /\bper\b|plan.*[eé]pargne.*retraite|retraite.*plan|plan.*retraite/i,                  fn: mkPER },
  { re: /fonds.*urgence|[eé]pargne.*s[eé]curit[eé]|matelas|3.*mois.*d[eé]p|6.*mois.*d[eé]p/i, fn: mkEmergencyFund },
  { re: /etf.*frais|frais.*etf|\bter\b|fonds.*actif|gestion.*active|indiciel/i,               fn: mkETFvsActif },
  { re: /tranche.*imp[oô]t|bar[eè]me.*ir|\bimp[oô]t.*revenu\b|\btmi\b/i,                     fn: mkIRTransches },
  { re: /scpi|pierre.*papier|soci[eé]t[eé].*civile.*placement/i,                             fn: mkSCPI },
  { re: /\bdca\b|dollar.?cost|investir.*chaque.*mois|mensuel.*r[eé]gulier|investissement.*r[eé]gulier/i, fn: mkDCA },
  { re: /\bptz\b|pr[eê]t.*z[eé]ro|primo.?acc[eé]d/i,                                        fn: mkPTZ },
  { re: /notaire|frais.*achat.*immo|frais.*acqu/i,                                           fn: mkNotaire },
  { re: /(rembours|solder|acc[eé]l[eé]r|anticip).{0,30}(cr[eé]dit|pr[eê]t|dette|emprunt)|(cr[eé]dit|pr[eê]t|dette).{0,30}(plus.{0,5}vite|rembours|anticip|solder)/i, fn: mkRepayFaster },
  { re: /emprunt|emprunter|cr[eé]dit|pr[eê]t|capacit[eé]|acheter.*appart|logement/i,         fn: mkBorrowing },
  { re: /pfu|pea|fiscalit[eé]|imp[oô]t|imposition|flat.?tax/i,                               fn: mkPFUvsPEA },
  { re: /[eé]pargn|combien.*mois|taux.*[eé]pargne|[eé]conomis/i,                             fn: mkSavings },
  { re: /bon moment|timing|march[eé]|investir maintenant|bourse/i,                           fn: mkTiming },
  { re: /allocation|r[eé]partition|quoi.*investir|portefeuille.*id[eé]al/i,                  fn: mkAllocation },
  { re: /fire|ind[eé]pendance.*financ|retraite.*anticip[eé]|libert[eé].*financ/i,            fn: mkFIRE },
  { re: /ouvrir.*pea|comment.*pea|[eé]tape.*pea/i,                                           fn: mkPEASteps },
];

export function classify(text, ctx) {
  const params = extractParams(text);

  // 1. PEA avant 5 ans — check avant tout le reste
  if (/pea/i.test(text) && /(cl[oô]tur|ferm|avant.{0,25}5.{0,5}ans|5.{0,5}ans.{0,25}pea|retir.{0,25}avant)/i.test(text))
    return mkPEAClotureAvant5Ans(ctx, params);

  // 2. Projection chiffrée — montant + (année cible ou durée) + verbe de simulation
  const hasAmount   = (params.amount > 0 || params.monthly > 0);
  const hasHorizon  = (params.targetYear != null || params.years != null);
  const hasSimVerb  = /(?:mets|met\b|investis|place|aurais|aurai|serai|serait|vaut|vaudra|combien|capital|rendrait|rapporterait)/i.test(text);
  if (hasAmount && hasHorizon && hasSimVerb)
    return mkProjection(ctx, params);

  // 3. Intents généraux
  for (const { re, fn } of INTENTS) {
    if (re.test(text)) return fn(ctx, params);
  }
  return mkDefault();
}

/* ─── Rendu d'un message assistant ────────────────────────────────── */
const EMOJI_ICON = {
  "✓": { Icon: CheckCircle2, color: C.green },
  "🎉": { Icon: PartyPopper, color: C.green },
  "💰": { Icon: Wallet, color: C.amber },
  "⚠": { Icon: AlertTriangle, color: C.amber },
};
function withIcons(text, keyPrefix) {
  return String(text).split(/([✓🎉💰⚠])️?/g).map((part, i) => {
    const e = EMOJI_ICON[part];
    if (!e) return part;
    const { Icon, color } = e;
    return (
      <Icon key={`${keyPrefix}-${i}`} size={13}
        style={{ color, display: "inline-block", verticalAlign: -2, margin: "0 1px" }} />
    );
  });
}

export function AssistantMessage({ data, onChip }) {
  const [quizAnswer, setQuizAnswer] = useState(null);
  const bold = (str) =>
    String(str).split(/\*\*(.*?)\*\*/g).map((p, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: C.cyan }}>{withIcons(p, `b${i}`)}</strong>
        : <React.Fragment key={i}>{withIcons(p, `n${i}`)}</React.Fragment>
    );
  return (
    <div className="flex flex-col gap-3" style={{ maxWidth: 560 }}>
      <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{bold(data.intro)}</div>

      {data.table && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
          {data.table.map((row, ri) => (
            <div key={ri} style={{
              display: "grid",
              gridTemplateColumns: row.length === 3 ? "1fr 1fr 1fr" : "1fr 1fr",
              background: ri === 0 ? "rgba(255,255,255,0.04)" : "transparent",
              borderBottom: ri < data.table.length - 1 ? `1px solid ${C.border}` : "none",
              padding: "7px 12px", fontSize: 12, gap: 4,
            }}>
              {row.map((cell, ci) => (
                <span key={ci} style={{
                  color: ri === 0 ? C.muted : ci === 0 ? C.muted : C.text,
                  fontWeight: ci > 0 && ri > 0 ? 600 : 400,
                  textAlign: ci > 0 ? "right" : "left",
                }}>
                  {bold(cell)}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {data.bullets && (
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {data.bullets.map((b, i) => (
            <li key={i} style={{ color: C.text, fontSize: 12, lineHeight: 1.75 }}>{bold(b)}</li>
          ))}
        </ul>
      )}

      {data.steps && (
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          {data.steps.map((s, i) => (
            <li key={i} style={{ color: C.text, fontSize: 12, lineHeight: 1.85, marginBottom: 2 }}>{bold(s)}</li>
          ))}
        </ol>
      )}

      {data.quiz && !quizAnswer && (
        <div>
          <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{data.quiz[0].question}</div>
          <div className="flex flex-col gap-2">
            {data.quiz[0].options.map((opt, i) => (
              <button key={i} onClick={() => setQuizAnswer(opt)}
                className="hover:bg-[rgba(47,155,255,0.12)] hover:border-[rgba(91,141,239,0.4)] transition-colors"
                style={{
                  background: "rgba(47,155,255,0.06)", border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12,
                  cursor: "pointer", textAlign: "left",
                }}>{opt.label}</button>
            ))}
          </div>
        </div>
      )}
      {data.quiz && quizAnswer && (
        <div className="flex items-start gap-2" style={{
          background: "rgba(34,199,154,0.06)", border: `1px solid rgba(34,199,154,0.25)`,
          borderRadius: 10, padding: "10px 14px", fontSize: 12,
        }}>
          <CheckCircle2 size={14} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ color: C.muted, marginBottom: 4 }}>Horizon {quizAnswer.label} →</div>
            <div style={{ color: C.green, fontWeight: 700 }}>{quizAnswer.portfolio}</div>
          </div>
        </div>
      )}

      {data.note && (
        <div className="flex items-start gap-2" style={{
          background: "rgba(245,166,35,0.06)", borderLeft: `3px solid ${C.amber}`,
          borderRadius: "0 8px 8px 0", padding: "8px 12px",
          color: C.muted, fontSize: 11, lineHeight: 1.5,
        }}>
          <Info size={13} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
          <div>{bold(data.note)}</div>
        </div>
      )}

      {data.chips?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.chips.map((c) => (
            <button key={c} onClick={() => onChip(c)}
              className="hover:bg-[rgba(139,92,246,0.16)] hover:border-[rgba(139,92,246,0.4)] transition-colors"
              style={{
                background: "rgba(139,92,246,0.08)", border: `1px solid rgba(139,92,246,0.25)`,
                borderRadius: 20, padding: "4px 12px", fontSize: 11, color: C.violet,
                cursor: "pointer", fontWeight: 500,
              }}>{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sujets suggérés ──────────────────────────────────────────────── */
export const QUICK = [
  "Capacité d'emprunt",
  "PEA avant 5 ans — fiscalité ?",
  "Livret A / Livrets",
  "Assurance-vie",
  "Fiscalité crypto",
  "PER - Plan Épargne Retraite",
  "Fonds d'urgence",
  "Mon FIRE / indépendance financière",
];
