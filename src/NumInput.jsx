import { useState, useEffect, useRef } from "react";

/**
 * NumInput — remplace <input type="number"> partout dans l'app.
 * Résout le bug "impossible de vider le champ" :
 *  - l'user tape librement (string locale)
 *  - la valeur numérique est commitée uniquement sur blur
 *  - onBlur externe optionnel conservé
 */
export default function NumInput({ value, onChange, onBlur, min, max, step, ...props }) {
  const [str, setStr] = useState(value != null ? String(value) : "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setStr(value != null ? String(value) : "");
  }, [value]);

  const commit = (raw) => {
    let n = parseFloat(String(raw).replace(",", "."));
    if (isNaN(n)) n = value ?? 0;
    if (min != null) n = Math.max(Number(min), n);
    if (max != null) n = Math.min(Number(max), n);
    onChange?.(n);
    setStr(String(n));
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={str}
      {...props}
      onChange={(e) => setStr(e.target.value)}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={(e) => {
        focused.current = false;
        commit(e.target.value);
        onBlur?.(e);
      }}
    />
  );
}
