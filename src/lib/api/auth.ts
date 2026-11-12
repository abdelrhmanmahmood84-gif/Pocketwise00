import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

/**
 * Register a new user with Supabase Auth.
 * Password hashing and session creation are handled securely by Supabase Auth.
 */
export async function signUpUser(params: {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  redirectTo?: string;
}) {
  const { email, password, fullName, phoneNumber, redirectTo } = params;

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: redirectTo || (typeof window !== "undefined" ? `${window.location.origin}/wallet` : undefined),
      data: {
        full_name: fullName.trim(),
        phone_number: phoneNumber?.trim() || null,
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInUser(params: { email: string; password: string }) {
  const { email, password } = params;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out the currently authenticated user.
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Send password reset email to user.
 */
export async function resetUserPassword(email: string, redirectTo?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectTo || (typeof window !== "undefined" ? `${window.location.origin}/settings` : undefined),
  });
  if (error) throw error;
}

/**
 * Retrieve the currently authenticated user.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return user;
}

/**
 * Retrieve the extended profile of the currently authenticated user.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Update current user's profile information.
 */
export async function updateCurrentProfile(updates: TablesUpdate<"profiles">): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required to update profile.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Listen to auth state changes (sign in, sign out, token refresh).
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
}

