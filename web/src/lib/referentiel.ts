// Valeurs utilisées dans la base Eco-Locaux (relevées le 14/10/2026).
export const ZONES = ["Paris", "Nord", "Sud", "Est", "Ouest"];

export const STATUTS = [
  "Nouveau",
  "Contacté",
  "À rappeler",
  "Injoignable",
  "RDV pris",
  "Pas intéressé",
  "Signé",
];

export const POTENTIELS = ["Élevé", "Moyen", "Faible"];

export const CANAUX = ["Appel", "E-mail", "Visite", "SMS"];

export const RESULTATS = [
  "Sans réponse",
  "À rappeler",
  "Intéressé",
  "RDV pris",
  "Pas intéressé",
  "Signature",
];

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function slug(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-");
}
