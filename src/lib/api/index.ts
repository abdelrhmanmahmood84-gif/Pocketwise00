export * from "./auth";
export * from "./categories";
export * from "./accounts";
export * from "./transactions";
export * from "./analytics";

import * as authApi from "./auth";
import * as categoriesApi from "./categories";
import * as accountsApi from "./accounts";
import * as transactionsApi from "./transactions";
import * as analyticsApi from "./analytics";

export const pocketwiseApi = {
  auth: authApi,
  categories: categoriesApi,
  accounts: accountsApi,
  transactions: transactionsApi,
  analytics: analyticsApi,
};

// Global browser window bridge for existing screens
if (typeof window !== "undefined") {
  (window as any).__pwApi = pocketwiseApi;
}

