import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssistantMessage } from "./Chatbot.jsx";

const data = {
  intro: "Voici votre **fonds d'urgence**.",
  table: [
    ["Objectif", "Cible", "Situation"],
    ["Minimum — 3 mois de dépenses", "6 000 €", "Manque 6 000 €"],
  ],
  bullets: ["Toujours sur Livret A."],
  note: "Cible 6 000 € (3 mois).",
  chips: ["Livret A / Livrets", "Allocation idéale"],
};

describe("AssistantMessage (rendu)", () => {
  it("affiche l'intro, le tableau et la note", () => {
    render(<AssistantMessage data={data} onChip={() => {}} />);
    expect(screen.getByText(/fonds d'urgence/i)).toBeInTheDocument();
    expect(screen.getByText("Minimum — 3 mois de dépenses")).toBeInTheDocument();
    expect(screen.getByText(/Cible 6 000 €/)).toBeInTheDocument();
  });

  it("les chips déclenchent onChip avec leur valeur", () => {
    const onChip = vi.fn();
    render(<AssistantMessage data={data} onChip={onChip} />);
    fireEvent.click(screen.getByText("Allocation idéale"));
    expect(onChip).toHaveBeenCalledWith("Allocation idéale");
  });
});
