"use client";

import { Provider } from "urql";
import { getGraphqlClient } from "@/lib/graphql/client";

export function GraphqlProvider({ children }: { children: React.ReactNode }) {
  return <Provider value={getGraphqlClient()}>{children}</Provider>;
}
