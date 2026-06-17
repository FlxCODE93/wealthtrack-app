/* Lignes lumineuses au survol — pop sur fond sombre/transparent avec couleur d'accent */
export default function NeonGlow({ color = "#ffffff" }) {
  const grad = `linear-gradient(to right, transparent, ${color}, transparent)`;
  return (
    <>
      <span className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: grad }} />
      <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-px opacity-0 group-hover:opacity-70 transition-opacity duration-500"
        style={{ background: grad }} />
    </>
  );
}
