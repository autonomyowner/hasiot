/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_mutations from "../admin/mutations.js";
import type * as admin_queries from "../admin/queries.js";
import type * as appointments_mutations from "../appointments/mutations.js";
import type * as appointments_queries from "../appointments/queries.js";
import type * as doctors_mutations from "../doctors/mutations.js";
import type * as doctors_queries from "../doctors/queries.js";
import type * as healthCards_mutations from "../healthCards/mutations.js";
import type * as healthCards_queries from "../healthCards/queries.js";
import type * as http from "../http.js";
import type * as symptoms_actions from "../symptoms/actions.js";
import type * as symptoms_mutations from "../symptoms/mutations.js";
import type * as symptoms_queries from "../symptoms/queries.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as webhooks_clerk from "../webhooks/clerk.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/mutations": typeof admin_mutations;
  "admin/queries": typeof admin_queries;
  "appointments/mutations": typeof appointments_mutations;
  "appointments/queries": typeof appointments_queries;
  "doctors/mutations": typeof doctors_mutations;
  "doctors/queries": typeof doctors_queries;
  "healthCards/mutations": typeof healthCards_mutations;
  "healthCards/queries": typeof healthCards_queries;
  http: typeof http;
  "symptoms/actions": typeof symptoms_actions;
  "symptoms/mutations": typeof symptoms_mutations;
  "symptoms/queries": typeof symptoms_queries;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  "webhooks/clerk": typeof webhooks_clerk;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
