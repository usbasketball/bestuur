import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { requireBestuur } from "@/lib/api-auth";

const yoga = createYoga({
  schema: makeExecutableSchema({
    typeDefs,
    resolvers: resolvers as Parameters<typeof makeExecutableSchema>[0]["resolvers"],
  }),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response, Request, ReadableStream },
});

export async function GET(request: Request) {
  const unauthorized = await requireBestuur();
  if (unauthorized) return unauthorized;
  return yoga.fetch(request);
}

export async function POST(request: Request) {
  const unauthorized = await requireBestuur();
  if (unauthorized) return unauthorized;
  return yoga.fetch(request);
}
