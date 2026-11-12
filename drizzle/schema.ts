import { pgTable, uuid, text, numeric, timestamp, date, jsonb, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/**
 * Profiles table linked to auth.users
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  email: text("email"),
  phoneNumber: text("phone_number"),
  defaultCurrency: text("default_currency").default("EGP").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Categories table (system predefined + user custom)
 */
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  icon: text("icon"),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("categories_user_type_idx").on(table.userId, table.type),
  check("categories_type_check", sql`${table.type} IN ('income', 'expense')`),
]);

/**
 * Accounts table (fiat, bank accounts, crypto/wallets)
 */
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(), // 'cash' | 'bank' | 'wallet' | 'other'
  initialBalance: numeric("initial_balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  currency: text("currency").default("EGP").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("accounts_user_idx").on(table.userId),
  check("accounts_type_check", sql`${table.accountType} IN ('cash', 'bank', 'wallet', 'other')`),
]);

/**
 * Central Transactions table with JSONB AI metadata
 */
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }).notNull(),
  transactionType: text("transaction_type").notNull(), // 'income' | 'expense'
  type: text("type").notNull(), // UI compatibility
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").default("EGP").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  merchant: text("merchant").notNull(), // UI compatibility
  transactionDate: date("transaction_date").defaultNow().notNull(),
  occurredOn: date("occurred_on").defaultNow().notNull(), // UI compatibility
  paymentMethod: text("payment_method"),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  account: text("account"), // UI compatibility
  notes: text("notes"),
  metadata: jsonb("metadata").default({}).notNull(), // AI & receipt analysis metadata
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("transactions_user_date_idx").on(table.userId, table.transactionDate),
  index("transactions_user_type_idx").on(table.userId, table.transactionType),
  index("transactions_user_cat_idx").on(table.userId, table.categoryId),
  index("transactions_user_acc_idx").on(table.userId, table.accountId),
  check("transactions_type_check", sql`${table.transactionType} IN ('income', 'expense')`),
  check("transactions_amount_check", sql`${table.amount} > 0`),
]);

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(profiles, { fields: [categories.userId], references: [profiles.id] }),
  transactions: many(transactions),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(profiles, { fields: [accounts.userId], references: [profiles.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(profiles, { fields: [transactions.userId], references: [profiles.id] }),
  categoryRel: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  accountRel: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
}));
