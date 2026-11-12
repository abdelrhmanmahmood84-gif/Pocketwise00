import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "./auth";

export interface MonthlyMetric {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color?: string;
  icon?: string;
}

export interface FinancialAnalyticsDashboard {
  currentMonth: {
    monthYear: string;
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    incomeChangePercent: number;
    expenseChangePercent: number;
    savingsChangePercent: number;
  };
  categoryBreakdown: CategoryBreakdown[];
  monthlyTrends: MonthlyMetric[];
  recentActivityCount: number;
}

/**
 * Retrieve comprehensive financial analytics for the current user.
 */
export async function getFinancialAnalytics(targetMonth?: string): Promise<FinancialAnalyticsDashboard> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      currentMonth: {
        monthYear: targetMonth || new Date().toISOString().slice(0, 7),
        totalIncome: 0,
        totalExpenses: 0,
        netSavings: 0,
        savingsRate: 0,
        incomeChangePercent: 0,
        expenseChangePercent: 0,
        savingsChangePercent: 0,
      },
      categoryBreakdown: [],
      monthlyTrends: [],
      recentActivityCount: 0,
    };
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const curMonth = targetMonth || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  
  // Compute previous month string
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;

  const { data: txs, error } = await supabase
    .from("transactions")
    .select("transaction_type, amount, category, transaction_date")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: true });

  if (error) throw error;

  let curIncome = 0;
  let curExpense = 0;
  let prevIncome = 0;
  let prevExpense = 0;

  const categoryTotals: Record<string, { amount: number; count: number }> = {};
  const monthBuckets: Record<string, { income: number; expense: number }> = {};

  (txs || []).forEach((t) => {
    const amt = Number(t.amount) || 0;
    const isInc = t.transaction_type === "income";
    const ym = (t.transaction_date || "").slice(0, 7);

    // Track in monthly bucket
    if (ym) {
      if (!monthBuckets[ym]) monthBuckets[ym] = { income: 0, expense: 0 };
      if (isInc) monthBuckets[ym].income += amt;
      else monthBuckets[ym].expense += amt;
    }

    // Target month calculations
    if (ym === curMonth) {
      if (isInc) {
        curIncome += amt;
      } else {
        curExpense += amt;
        const cat = t.category || "General";
        if (!categoryTotals[cat]) categoryTotals[cat] = { amount: 0, count: 0 };
        categoryTotals[cat].amount += amt;
        categoryTotals[cat].count++;
      }
    } else if (ym === prevMonth) {
      if (isInc) prevIncome += amt;
      else prevExpense += amt;
    }
  });

  const curNet = curIncome - curExpense;
  const prevNet = prevIncome - prevExpense;

  const calcChange = (cur: number, prev: number) => {
    if (prev === 0) return 0;
    return Math.round(((cur - prev) / Math.abs(prev)) * 100 * 10) / 10;
  };

  const curSavingsRate = curIncome > 0 ? Math.round((curNet / curIncome) * 100 * 10) / 10 : 0;

  // Build Category Breakdown
  const categoryBreakdown: CategoryBreakdown[] = Object.entries(categoryTotals)
    .map(([category, val]) => ({
      category,
      amount: val.amount,
      count: val.count,
      percentage: curExpense > 0 ? Math.round((val.amount / curExpense) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Build Monthly Trends
  const monthlyTrends: MonthlyMetric[] = Object.entries(monthBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, b]) => ({
      month,
      income: b.income,
      expense: b.expense,
      net: b.income - b.expense,
    }));

  return {
    currentMonth: {
      monthYear: curMonth,
      totalIncome: curIncome,
      totalExpenses: curExpense,
      netSavings: curNet,
      savingsRate: curSavingsRate,
      incomeChangePercent: calcChange(curIncome, prevIncome),
      expenseChangePercent: calcChange(curExpense, prevExpense),
      savingsChangePercent: calcChange(curNet, prevNet),
    },
    categoryBreakdown,
    monthlyTrends,
    recentActivityCount: (txs || []).length,
  };
}

/**
 * Prepares clean structured financial history ready for future AI analysis agents.
 * Extracts trends, spending habits, anomaly flags, and net worth trajectory.
 */
export async function getAiFinancialDataset(): Promise<{
  profile: any;
  summary: {
    totalTransactions: number;
    lifetimeInflow: number;
    lifetimeOutflow: number;
    lifetimeNet: number;
    averageMonthlyBurnRate: number;
  };
  monthlyPerformance: MonthlyMetric[];
  categoryDistribution: CategoryBreakdown[];
  highValueTransactions: any[];
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required.");

  const { data: txs, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false });

  if (error) throw error;

  let totalIn = 0;
  let totalOut = 0;
  const monthBuckets: Record<string, { income: number; expense: number }> = {};
  const catTotals: Record<string, { amount: number; count: number }> = {};
  const highValue: any[] = [];

  (txs || []).forEach((t) => {
    const amt = Number(t.amount) || 0;
    const isInc = t.transaction_type === "income";
    const ym = (t.transaction_date || "").slice(0, 7);

    if (isInc) totalIn += amt;
    else totalOut += amt;

    if (ym) {
      if (!monthBuckets[ym]) monthBuckets[ym] = { income: 0, expense: 0 };
      if (isInc) monthBuckets[ym].income += amt;
      else monthBuckets[ym].expense += amt;
    }

    if (!isInc) {
      const cat = t.category || "General";
      if (!catTotals[cat]) catTotals[cat] = { amount: 0, count: 0 };
      catTotals[cat].amount += amt;
      catTotals[cat].count++;
    }

    // Flag high value items (e.g. > 1000 or significant)
    if (amt > 1000) {
      highValue.push({
        id: t.id,
        type: t.transaction_type,
        amount: amt,
        category: t.category,
        description: t.description,
        date: t.transaction_date,
      });
    }
  });

  const monthsCount = Math.max(1, Object.keys(monthBuckets).length);

  return {
    profile: {
      userId: user.id,
      email: user.email,
    },
    summary: {
      totalTransactions: (txs || []).length,
      lifetimeInflow: totalIn,
      lifetimeOutflow: totalOut,
      lifetimeNet: totalIn - totalOut,
      averageMonthlyBurnRate: Math.round((totalOut / monthsCount) * 100) / 100,
    },
    monthlyPerformance: Object.entries(monthBuckets).map(([m, b]) => ({
      month: m,
      income: b.income,
      expense: b.expense,
      net: b.income - b.expense,
    })),
    categoryDistribution: Object.entries(catTotals).map(([cat, val]) => ({
      category: cat,
      amount: val.amount,
      count: val.count,
      percentage: totalOut > 0 ? Math.round((val.amount / totalOut) * 100 * 10) / 10 : 0,
    })),
    highValueTransactions: highValue.slice(0, 10),
  };
}

