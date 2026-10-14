"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function texte(formData: FormData, cle: string): string | null {
  const v = String(formData.get(cle) ?? "").trim();
  return v === "" ? null : v;
}

export async function ajouterInteraction(commerceId: number, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("interaction").insert({
    commerce_id: commerceId,
    commercial_id: Number(formData.get("commercial_id")) || null,
    date_interaction: texte(formData, "date_interaction"),
    canal: texte(formData, "canal"),
    resultat: texte(formData, "resultat"),
    commentaire: texte(formData, "commentaire"),
    date_relance: texte(formData, "date_relance"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/commerces/${commerceId}`);
  revalidatePath("/relances");
}

export async function changerStatut(commerceId: number, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("commerce")
    .update({ statut_prospection: texte(formData, "statut_prospection") })
    .eq("id", commerceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/commerces/${commerceId}`);
  revalidatePath("/commerces");
}
