import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "./auth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;

/**
 * Retrieve all available categories for the authenticated user
 * (Both system-wide defaults and user-defined custom categories).
 */
export async function getCategories(type?: "income" | "expense"): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Create a new user-custom category.
 */
export async function createCategory(params: {
  name: string;
  type: "income" | "expense";
  icon?: string;
  color?: string;
}): Promise<Category> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required to create a category.");

  const payload: TablesInsert<"categories"> = {
    user_id: user.id,
    name: params.name.trim(),
    type: params.type,
    icon: params.icon || null,
    color: params.color || null,
  };

  const { data, error } = await supabase
    .from("categories")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a custom category owned by the user.
 */
export async function deleteCategory(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

