import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, X } from "lucide-react";
import { C } from "./theme.js";
import { storage } from "./storage.js";
import { classify, AssistantMessage, QUICK } from "./Chatbot.jsx";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const DISMISS_KEY = "wt_chat_dismissed_until";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const SHOW_DELAY_MS = 4000;
const SHOW_SCROLL_PX = 300;

const DEFAULT_CTX = {
  totals: { revenus: 3000, invest: 200, chargesFixes: 1200, depensesVar: 600 },
  simParams: { monthly: 200 },
  patrimoine: { actifs: [], passifs: [] },
};

function AIChatCard({ ctx, onClose, onSignup, seed, onSeedConsumed }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const isDemo = !ctx;

  const safeCtx = useMemo(() => ({
    totals: { ...DEFAULT_CTX.totals, ...(ctx?.totals || {}) },
    simParams: { ...DEFAULT_CTX.simParams, ...(ctx?.simParams || {}) },
    patrimoine: ctx?.patrimoine || DEFAULT_CTX.patrimoine,
    profileType: ctx?.profileType || "salarie_stable",
  }), [ctx]);

  const particles = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => ({
        left: `${Math.random() * 100}%`,
        x: [Math.random() * 200 - 100, Math.random() * 200 - 100],
        duration: 5 + Math.random() * 3,
        delay: i * 0.5,
      })),
    []
  );

  const handleChip = (q) => {
    if (isDemo && onSignup && q.includes("Commencer")) { onSignup(); return; }
    sendMessage(q);
  };

  const sendMessage = (text) => {
    const userText = text.trim();
    if (!userText) return;
    const data = classify(userText, safeCtx);
    if (isDemo) {
      data.note = "Ces chiffres sont illustratifs (revenus de démo : 3 000 €). Connectez-vous pour une simulation sur vos vraies données.";
      data.chips = ["Commencer gratuitement →"];
    }
    setMsgs((prev) => [
      ...prev,
      { role: "user", id: Date.now(), text: userText },
      { role: "bot", id: Date.now() + 1, data },
    ]);
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter") sendMessage(input);
  };

  // Objectif injecté depuis "Optimiser mon mois par IA" → envoyé automatiquement une fois.
  useEffect(() => {
    if (!seed) return;
    sendMessage(seed);
    onSeedConsumed?.();
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-[400px] max-w-[92vw] h-[560px] max-h-[80vh] rounded-2xl overflow-hidden p-[2px]"
      style={{ background: C.gradientPrimary }}>
      {/* Anneau lumineux animé — gradient WealthTrack */}
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-white/25"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex flex-col w-full h-full rounded-xl overflow-hidden backdrop-blur-xl">
        {/* Fond — mesh gradient WealthTrack */}
        <div className="absolute inset-0" style={{ background: C.bgGradient }} />

        {/* Particules flottantes */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/10"
            animate={{ y: ["0%", "-140%"], x: p.x, opacity: [0, 1, 0] }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
            style={{ left: p.left, bottom: "-10%" }}
          />
        ))}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 relative z-10">
          <h2 className="text-base font-semibold" style={{ color: C.text }}>Assistant WealthTrack</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" style={{ color: C.muted }} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3 text-sm flex flex-col relative z-10">
          {msgs.length === 0 && (
            <div className="flex flex-col gap-3 items-center text-center px-2 pt-6">
              <div className="font-semibold" style={{ color: C.text }}>
                Bonjour ! Je suis votre assistant financier WealthTrack.
              </div>
              <div style={{ color: C.muted, fontSize: 12 }}>
                Posez votre question en langage naturel ou choisissez un sujet.
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="hover:bg-[rgba(59,130,246,0.16)] hover:border-[rgba(59,130,246,0.4)] transition-colors"
                    style={{
                      background: "rgba(59,130,246,0.08)", border: `1px solid rgba(59,130,246,0.25)`,
                      borderRadius: 20, padding: "5px 12px", fontSize: 11, color: C.violet, cursor: "pointer",
                    }}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={cn(
                "px-3 py-2 rounded-xl shadow-md backdrop-blur-md",
                msg.role === "user" ? "max-w-[80%] bg-white/20 self-end" : "max-w-full bg-black/30 self-start"
              )}
              style={msg.role === "user" ? { color: C.text } : {}}
            >
              {msg.role === "user" ? msg.text : <AssistantMessage data={msg.data} onChip={handleChip} />}
            </motion.div>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 p-3 border-t border-white/10 relative z-10">
          <input
            className="flex-1 px-3 py-2 text-sm bg-black/30 rounded-lg border border-white/10 focus:outline-none focus:ring-1 focus:ring-white/50"
            style={{ color: C.text }}
            placeholder="Écrivez un message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            onClick={() => sendMessage(input)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Send className="w-4 h-4" style={{ color: C.text }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIChatWidget({ ctx, onSignup }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [seed, setSeed] = useState(null);

  useEffect(() => {
    const dismissedUntil = Number(storage.get(DISMISS_KEY, 0));
    if (Date.now() < dismissedUntil) return;

    let shown = false;
    const reveal = () => {
      if (shown) return;
      shown = true;
      setVisible(true);
    };

    const timer = setTimeout(reveal, SHOW_DELAY_MS);
    const onScroll = () => { if (window.scrollY > SHOW_SCROLL_PX) reveal(); };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Ouverture forcée depuis un bouton ailleurs dans l'app (avec objectif optionnel)
    const onOpenChat = (e) => {
      setVisible(true);
      setOpen(true);
      if (e?.detail?.prompt) setSeed(e.detail.prompt);
    };
    window.addEventListener("wt:open-chat", onOpenChat);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wt:open-chat", onOpenChat);
    };
  }, []);

  const dismiss = () => {
    storage.set(DISMISS_KEY, Date.now() + DISMISS_DURATION_MS);
    setOpen(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50"
          >
            <AIChatCard ctx={ctx} onClose={() => setOpen(false)} onSignup={onSignup} seed={seed} onSeedConsumed={() => setSeed(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-50">
        {!open && (
          <button
            onClick={dismiss}
            aria-label="Masquer l'assistant"
            className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full flex items-center justify-center bg-black/60 border border-white/20 hover:bg-black/80 transition-colors"
          >
            <X className="w-3 h-3 text-white/70" />
          </button>
        )}
        <motion.button
          onClick={() => setOpen((o) => !o)}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: C.gradientPrimary }}
          aria-label="Ouvrir l'assistant financier"
        >
          {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        </motion.button>
      </div>
    </>
  );
}
