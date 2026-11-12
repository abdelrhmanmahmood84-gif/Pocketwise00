import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "./auth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Account = Tables<"accounts">;

/**
 * Retrieve all financial accounts belonging to the authenticated user.
 */
export async function getAccounts(): Promise<Account[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new financial account (e.g. Cash, Bank, Digital Wallet).
 */
export async function createAccount(params: {
  accountName: string;
  accountType: "cash" | "bank" | "wallet" | "other";
  initialBalance?: number;
  currency?: string;
}): Promise<Account> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required to create an account.");

  const payload: TablesInsert<"accounts"> = {
    user_id: user.id,
    account_name: params.accountName.trim(),
    account_type: params.accountType,
    initial_balance: params.initialBalance ?? 0,
    currency: params.currency || "EGP",
  };

  const { data, error } = await supabase
    .from("accounts")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing account.
 */
export async function updateAccount(
  id: string,
  updates: Partial<TablesUpdate<"accounts">>
): Promise<Account> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");

  const { data, error } = await supabase
    .from("accounts")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a user financial account.
 */
export async function deleteAccount(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Calculate dynamic live balances for each account (Initial Balance + Incomes - Expenses).
 */
export async function getAccountBalances(): Promise<
  Array<Account & { current_balance: number; transaction_count: number }>
> {
  const user = await getCurrentUser();
  if (!user) return [];

  const [accounts, { data: txs, error: txError }] = await Promise.all([
    getAccounts(),
    supabase
      .from("transactions")
      .select("account_id, transaction_type, amount")
      .eq("user_id", user.id),
  ]);

  if (txError) throw txError;

  const txByAccount: Record<string, { sum: number; count: number }> = {};

  (txs || []).forEach((tx) => {
    if (!tx.account_id) return;
    if (!txByAccount[tx.account_id]) {
      txByAccount[tx.account_id] = { sum: 0, count: 0 };
    }
    const val = Number(tx.amount) || 0;
    txByAccount[tx.account_id].sum += tx.transaction_type === "income" ? val : -val;
    txByAccount[tx.account_id].count++;
  });

  return accounts.map((acc) => {
    const agg = txByAccount[acc.id] || { sum: 0, count: 0 };
    return {
      ...acc,
      current_balance: Number(acc.initial_balance) + agg.sum,
      transaction_count: agg.count,
    };
  });
}

