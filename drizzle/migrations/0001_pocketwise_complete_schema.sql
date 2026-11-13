-- Drizzle migration for complete PocketWise backend architecture
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "full_name" text,
  "email" text,
  "phone_number" text,
  "default_currency" text DEFAULT 'EGP' NOT NULL,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "icon" text,
  "color" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "categories_type_check" CHECK ("type" IN ('income', 'expense'))
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "account_name" text NOT NULL,
  "account_type" text NOT NULL,
  "initial_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
  "currency" text DEFAULT 'EGP' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_type_check" CHECK ("account_type" IN ('cash', 'bank', 'wallet', 'other'))
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "transaction_type" text NOT NULL,
  "type" text NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "currency" text DEFAULT 'EGP' NOT NULL,
  "category_id" uuid,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "merchant" text NOT NULL,
  "transaction_date" date DEFAULT now() NOT NULL,
  "occurred_on" date DEFAULT now() NOT NULL,
  "payment_method" text,
  "account_id" uuid,
  "account" text,
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "transactions_type_check" CHECK ("transaction_type" IN ('income', 'expense')),
  CONSTRAINT "transactions_amount_check" CHECK ("amount" > 0)
);

-- Foreign key constraints
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE set null ON UPDATE no action;

-- Indexes
CREATE INDEX IF NOT EXISTS "categories_user_type_idx" ON "categories" ("user_id", "type");
CREATE INDEX IF NOT EXISTS "accounts_user_idx" ON "accounts" ("user_id");
CREATE INDEX IF NOT EXISTS "transactions_user_date_idx" ON "transactions" ("user_id", "transaction_date");
CREATE INDEX IF NOT EXISTS "transactions_user_type_idx" ON "transactions" ("user_id", "transaction_type");
CREATE INDEX IF NOT EXISTS "transactions_user_cat_idx" ON "transactions" ("user_id", "category_id");
CREATE INDEX IF NOT EXISTS "transactions_user_acc_idx" ON "transactions" ("user_id", "account_id");

