"use client";

import { Client, createClient, fetchExchange } from "urql";

let client: Client | null = null;

export function getGraphqlClient(): Client {
  if (client) return client;
  client = createClient({
    url: "/api/graphql",
    exchanges: [fetchExchange],
    fetchOptions: { cache: "no-store" },
  });
  return client;
}
