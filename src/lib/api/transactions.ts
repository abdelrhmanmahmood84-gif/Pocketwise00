import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "./auth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions">;

export interface TransactionFilters {
  type?: "income" | "expense" | "all";
  categoryId?: string;
  category?: string;
  accountId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Retrieve transactions for the authenticated user with multi-criteria filtering.
 */
export async function getTransactions(filters: TransactionFilters = {}): Promise<{
  data: Transaction[];
  count: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { data: [], count: 0 };

  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.type && filters.type !== "all") {
    query = query.eq("transaction_type", filters.type);
  }

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  } else if (filters.category && filters.category !== "all") {
    query = query.ilike("category", `%${filters.category}%`);
  }

  if (filters.accountId) {
    query = query.eq("account_id", filters.accountId);
  }

  if (filters.startDate) {
    query = query.gte("transaction_date", filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte("transaction_date", filters.endDate);
  }

  if (filters.minAmount !== undefined) {
    query = query.gte("amount", filters.minAmount);
  }

  if (filters.maxAmount !== undefined) {
    query = query.lte("amount", filters.maxAmount);
  }

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`description.ilike.${term},merchant.ilike.${term},notes.ilike.${term}`);
  }

  if (filters.limit) {
    const offset = filters.offset || 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    data: data || [],
    count: count || 0,
  };
}

/**
 * Retrieve a single transaction by ID.
 */
export async function getTransactionById(id: string): Promise<Transaction | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Create a new financial transaction (Income or Expense).
 */
export async function createTransaction(params: {
  transactionType: "income" | "expense";
  amount: number;
  currency?: string;
  description: string;
  categoryId?: string;
  category?: string;
  accountId?: string;
  account?: string;
  transactionDate?: string;
  paymentMethod?: string;
  notes?: string;
  metadata?: Record<string, any>;
}): Promise<Transaction> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required to record a transaction.");

  if (!(params.amount > 0)) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  const payload: TablesInsert<"transactions"> = {
    user_id: user.id,
    transaction_type: params.transactionType,
    type: params.transactionType,
    amount: Math.round(params.amount * 100) / 100,
    currency: params.currency || "EGP",
    description: params.description.trim(),
    merchant: params.description.trim(),
    category_id: params.categoryId || null,
    category: params.category?.trim() || "General",
    account_id: params.accountId || null,
    account: params.account?.trim() || "Primary Account",
    transaction_date: params.transactionDate || new Date().toISOString().slice(0, 10),
    occurred_on: params.transactionDate || new Date().toISOString().slice(0, 10),
    payment_method: params.paymentMethod || null,
    notes: params.notes?.trim() || null,
    metadata: params.metadata || {},
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing financial transaction.
 */
export async function updateTransaction(
  id: string,
  updates: Partial<TablesUpdate<"transactions">>
): Promise<Transaction> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");

  const { data, error } = await supabase
    .from("transactions")
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
 * Delete a financial transaction.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Compute the consolidated balance and monthly in/out figures.
 */
export async function getFinancialSummary(monthString?: string): Promise<{
  consolidatedBalance: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  monthlyNet: number;
  savingsRate: number;
  totalTransactionsCount: number;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      consolidatedBalance: 0,
      monthlyInflow: 0,
      monthlyOutflow: 0,
      monthlyNet: 0,
      savingsRate: 0,
      totalTransactionsCount: 0,
    };
  }

  const currentMonth = monthString || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  const { data: allTxs, error } = await supabase
    .from("transactions")
    .select("transaction_type, amount, transaction_date")
    .eq("user_id", user.id);

  if (error) throw error;

  let balance = 0;
  let inMonth = 0;
  let outMonth = 0;

  (allTxs || []).forEach((t) => {
    const amt = Number(t.amount) || 0;
    const isIncome = t.transaction_type === "income";
    balance += isIncome ? amt : -amt;

    const tMonth = (t.transaction_date || "").slice(0, 7);
    if (tMonth === currentMonth) {
      if (isIncome) inMonth += amt;
      else outMonth += amt;
    }
  });

  const net = inMonth - outMonth;
  const rate = inMonth > 0 ? Math.round((net / inMonth) * 100) : 0;

  return {
    consolidatedBalance: balance,
    monthlyInflow: inMonth,
    monthlyOutflow: outMonth,
    monthlyNet: net,
    savingsRate: rate,
    totalTransactionsCount: (allTxs || []).length,
  };
}

