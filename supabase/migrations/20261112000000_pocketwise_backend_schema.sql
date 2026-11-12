-- ==============================================================================
-- POCKETWISE DATABASE SCHEMA & BACKEND ARCHITECTURE
-- Fully secure, scalable PostgreSQL + Supabase Auth schema with Row Level Security (RLS)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. PROFILES TABLE (User Profile linked to auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone_number text,
  default_currency text NOT NULL DEFAULT 'EGP',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Stores extended profile data for authenticated users.';

-- ==============================================================================
-- 3. CATEGORIES TABLE (System default & custom user categories)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL indicates system-wide default
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  icon text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Income and expense categories (both system-wide and user-customized).';

-- ==============================================================================
-- 4. FINANCIAL ACCOUNTS TABLE (Cash, Banks, Wallets, etc.)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('cash', 'bank', 'wallet', 'other')),
  initial_balance numeric(14,2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'EGP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.accounts IS 'User-managed financial accounts across fiat, banks, and crypto/digital wallets.';

-- ==============================================================================
-- 5. CENTRAL TRANSACTIONS TABLE (Income & Expenses unified)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  type text NOT NULL CHECK (type IN ('income', 'expense')), -- Synced for UI backward-compatibility
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'EGP',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  category text NOT NULL, -- Synced category label
  description text NOT NULL,
  merchant text NOT NULL, -- Synced merchant label for UI backward-compatibility
  transaction_date date NOT NULL DEFAULT current_date,
  occurred_on date NOT NULL DEFAULT current_date, -- Synced date for UI backward-compatibility
  payment_method text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  account text, -- Synced account label
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- Ready for AI financial analysis, OCR receipt tags, merchant categorizations
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'Central financial ledger capturing all user transactions with JSONB AI metadata.';

-- ==============================================================================
-- 6. AUTOMATIC COLUMN SYNCHRONIZATION TRIGGER (Zero UI Breaking Changes)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_transaction_columns()
RETURNS trigger AS $$
BEGIN
  -- Bidirectional sync: transaction_type <-> type
  IF NEW.transaction_type IS NOT NULL AND NEW.type IS NULL THEN
    NEW.type := NEW.transaction_type;
  ELSIF NEW.type IS NOT NULL AND NEW.transaction_type IS NULL THEN
    NEW.transaction_type := NEW.type;
  ELSIF NEW.transaction_type IS NOT NULL THEN
    NEW.type := NEW.transaction_type;
  END IF;

  -- Bidirectional sync: description <-> merchant
  IF NEW.description IS NOT NULL AND NEW.merchant IS NULL THEN
    NEW.merchant := NEW.description;
  ELSIF NEW.merchant IS NOT NULL AND NEW.description IS NULL THEN
    NEW.description := NEW.merchant;
  ELSIF NEW.description IS NOT NULL THEN
    NEW.merchant := NEW.description;
  END IF;

  -- Bidirectional sync: transaction_date <-> occurred_on
  IF NEW.transaction_date IS NOT NULL AND NEW.occurred_on IS NULL THEN
    NEW.occurred_on := NEW.transaction_date;
  ELSIF NEW.occurred_on IS NOT NULL AND NEW.transaction_date IS NULL THEN
    NEW.transaction_date := NEW.occurred_on;
  ELSIF NEW.transaction_date IS NOT NULL THEN
    NEW.occurred_on := NEW.transaction_date;
  END IF;

  -- Default currency if absent
  IF NEW.currency IS NULL THEN
    NEW.currency := 'EGP';
  END IF;

  -- Default metadata if absent
  IF NEW.metadata IS NULL THEN
    NEW.metadata := '{}'::jsonb;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_transaction_columns ON public.transactions;
CREATE TRIGGER trg_sync_transaction_columns
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_transaction_columns();

-- Generic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. NEW USER REGISTRATION HOOK (Auto-provision Profile & Default Accounts)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_full_name text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- 1. Create Profile
  INSERT INTO public.profiles (id, full_name, email, default_currency, created_at, updated_at)
  VALUES (NEW.id, v_full_name, NEW.email, 'EGP', now(), now())
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      updated_at = now();

  -- 2. Create Default Starter Accounts
  INSERT INTO public.accounts (user_id, account_name, account_type, initial_balance, currency)
  VALUES
    (NEW.id, 'Cash Wallet', 'cash', 0.00, 'EGP'),
    (NEW.id, 'Primary Bank', 'bank', 0.00, 'EGP');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- --- Profiles RLS ---
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- --- Categories RLS ---
-- Users can see system default categories (user_id IS NULL) + their own custom categories
DROP POLICY IF EXISTS "categories_select_allowed" ON public.categories;
CREATE POLICY "categories_select_allowed" ON public.categories
FOR SELECT TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
CREATE POLICY "categories_insert_own" ON public.categories
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
CREATE POLICY "categories_update_own" ON public.categories
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;
CREATE POLICY "categories_delete_own" ON public.categories
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- --- Accounts RLS ---
DROP POLICY IF EXISTS "accounts_select_own" ON public.accounts;
CREATE POLICY "accounts_select_own" ON public.accounts
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_insert_own" ON public.accounts;
CREATE POLICY "accounts_insert_own" ON public.accounts
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_update_own" ON public.accounts;
CREATE POLICY "accounts_update_own" ON public.accounts
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "accounts_delete_own" ON public.accounts;
CREATE POLICY "accounts_delete_own" ON public.accounts
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- --- Transactions RLS ---
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own" ON public.transactions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own" ON public.transactions
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own" ON public.transactions
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ==============================================================================
-- 9. PERFORMANCE & ANALYTICAL INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON public.transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_gin ON public.transactions USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);

-- ==============================================================================
-- 10. FUTURE AI FINANCIAL ANALYSIS & AGGREGATION VIEWS / FUNCTIONS
-- ==============================================================================
-- View providing monthly financial rollups per user (income, expense, net savings, rate)
CREATE OR REPLACE VIEW public.user_monthly_financial_summaries AS
SELECT
  user_id,
  to_char(transaction_date, 'YYYY-MM') AS month_year,
  currency,
  COUNT(*)::int AS transaction_count,
  COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
  COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0) AS net_savings,
  CASE
    WHEN COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) > 0 THEN
      ROUND(
        ((COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0) /
          SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END)) * 100)::numeric,
        2
      )
    ELSE 0.00
  END AS savings_rate_percentage
FROM public.transactions
GROUP BY user_id, to_char(transaction_date, 'YYYY-MM'), currency;

-- View providing category spending distribution (designed for AI spending patterns)
CREATE OR REPLACE VIEW public.user_category_spending_analysis AS
SELECT
  user_id,
  to_char(transaction_date, 'YYYY-MM') AS month_year,
  category,
  category_id,
  transaction_type,
  COUNT(*)::int AS count,
  SUM(amount) AS total_amount,
  ROUND(AVG(amount), 2) AS avg_transaction_amount,
  MIN(amount) AS min_amount,
  MAX(amount) AS max_amount
FROM public.transactions
GROUP BY user_id, to_char(transaction_date, 'YYYY-MM'), category, category_id, transaction_type;

-- Function: Compute user net worth / consolidated balance
CREATE OR REPLACE FUNCTION public.get_user_financial_metrics(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_income numeric(14,2);
  v_expense numeric(14,2);
  v_balance numeric(14,2);
  v_count int;
  v_res jsonb;
BEGIN
  -- Strict isolation
  IF auth.uid() <> p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Access denied to requested financial metrics.';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE -amount END), 0),
    COUNT(*)
  INTO v_income, v_expense, v_balance, v_count
  FROM public.transactions
  WHERE user_id = p_user_id;

  v_res := jsonb_build_object(
    'total_income', v_income,
    'total_expense', v_expense,
    'consolidated_balance', v_balance,
    'transaction_count', v_count,
    'savings_rate', CASE WHEN v_income > 0 THEN ROUND(((v_balance / v_income) * 100)::numeric, 2) ELSE 0.00 END
  );

  RETURN v_res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 11. SEED DEFAULT SYSTEM CATEGORIES
-- ==============================================================================
INSERT INTO public.categories (user_id, name, type, icon, color)
VALUES
  -- Expense Categories
  (NULL, 'Housing & Rent', 'expense', 'home', '#1e293b'),
  (NULL, 'Groceries & Food', 'expense', 'shopping_cart', '#0284c7'),
  (NULL, 'Dining & Drinks', 'expense', 'local_cafe', '#f59e0b'),
  (NULL, 'Transportation', 'expense', 'directions_car', '#6366f1'),
  (NULL, 'Utilities & Bills', 'expense', 'receipt_long', '#64748b'),
  (NULL, 'Healthcare', 'expense', 'medical_services', '#ef4444'),
  (NULL, 'Entertainment', 'expense', 'movie', '#ec4899'),
  (NULL, 'Shopping', 'expense', 'shopping_bag', '#8b5cf6'),
  (NULL, 'General', 'expense', 'payments', '#475569'),

  -- Income Categories
  (NULL, 'Salary & Wages', 'income', 'work', '#10b981'),
  (NULL, 'Freelance & Contract', 'income', 'laptop_mac', '#06b6d4'),
  (NULL, 'Investments & Dividends', 'income', 'trending_up', '#3b82f6'),
  (NULL, 'Business & Sales', 'income', 'storefront', '#84cc16'),
  (NULL, 'Gifts & Grants', 'income', 'redeem', '#f43f5e'),
  (NULL, 'Other Income', 'income', 'savings', '#14b8a6')
ON CONFLICT DO NOTHING;

