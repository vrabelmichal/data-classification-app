import { useMemo } from "react";
import { useQueries, type RequestForQueries } from "convex/react";
import { getFunctionName, type FunctionArgs, type FunctionReference, type FunctionReturnType } from "convex/server";
import { convexToJson } from "convex/values";

// Unlike useQuery, useQueries returns server errors as values so the caller can
// keep its controls mounted and recover when the user changes the request.
export function useQueryResult<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): { data: FunctionReturnType<Query> | undefined; error: Error | undefined } {
  const skip = args === "skip";
  const queryArgs = skip ? {} : args;
  const queryName = getFunctionName(query);
  // Convex's subscription callbacks must stay stable across equivalent renders,
  // including skipped requests. Match useQuery's value-based memoization so
  // inline argument objects (and Convex values such as bigint) work correctly.
  const requests = useMemo<RequestForQueries>(
    () => skip ? {} : { result: { query, args: queryArgs } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryName, JSON.stringify(convexToJson(queryArgs)), skip],
  );
  const result = useQueries(requests).result;
  return result instanceof Error
    ? { data: undefined, error: result }
    : { data: result, error: undefined };
}
