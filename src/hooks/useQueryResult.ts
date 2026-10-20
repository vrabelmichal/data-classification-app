import { useQueries } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

// Unlike useQuery, useQueries returns server errors as values so the caller can
// keep its controls mounted and recover when the user changes the request.
export function useQueryResult<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): { data: FunctionReturnType<Query> | undefined; error: Error | undefined } {
  const result = useQueries(args === "skip" ? {} : { result: { query, args } }).result;
  return result instanceof Error
    ? { data: undefined, error: result }
    : { data: result, error: undefined };
}
