import { describe, expect, it } from "vitest";
import { profiles, categories, accounts, transactions } from "../../drizzle/schema";

describe("PocketWise Database Schema Verification", () => {
  it("defines profiles table with correct columns", () => {
    expect(profiles.id).toBeDefined();
    expect(profiles.fullName).toBeDefined();
    expect(profiles.email).toBeDefined();
    expect(profiles.phoneNumber).toBeDefined();
    expect(profiles.defaultCurrency).toBeDefined();
    expect(profiles.createdAt).toBeDefined();
    expect(profiles.updatedAt).toBeDefined();
  });

  it("defines categories table with type constraints", () => {
    expect(categories.id).toBeDefined();
    expect(categories.userId).toBeDefined();
    expect(categories.name).toBeDefined();
    expect(categories.type).toBeDefined();
    expect(categories.icon).toBeDefined();
    expect(categories.color).toBeDefined();
  });

  it("defines accounts table for multi-account management", () => {
    expect(accounts.id).toBeDefined();
    expect(accounts.userId).toBeDefined();
    expect(accounts.accountName).toBeDefined();
    expect(accounts.accountType).toBeDefined();
    expect(accounts.initialBalance).toBeDefined();
    expect(accounts.currency).toBeDefined();
  });

  it("defines central transactions table with AI metadata and financial fields", () => {
    expect(transactions.id).toBeDefined();
    expect(transactions.userId).toBeDefined();
    expect(transactions.transactionType).toBeDefined();
    expect(transactions.amount).toBeDefined();
    expect(transactions.currency).toBeDefined();
    expect(transactions.categoryId).toBeDefined();
    expect(transactions.accountId).toBeDefined();
    expect(transactions.description).toBeDefined();
    expect(transactions.transactionDate).toBeDefined();
    expect(transactions.metadata).toBeDefined();
  });
});

