import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { getAuthContext, requireAuthenticated } from "@/lib/api-auth";

const yoga = createYoga({
  schema: makeExecutableSchema({
    typeDefs,
    resolvers: resolvers as Parameters<typeof makeExecutableSchema>[0]["resolvers"],
  }),
  context: async ({ request }) => {
    return getAuthContext(request);
  },
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response, Request, ReadableStream },
});

export async function GET(request: Request) {
  const unauthorized = await requireAuthenticated(request);
  if (unauthorized) return unauthorized;
  return yoga.fetch(request);
}

export async function POST(request: Request) {
  const unauthorized = await requireAuthenticated(request);
  if (unauthorized) return unauthorized;
  return yoga.fetch(request);
}

export async function OPTIONS(request: Request) {
  return yoga.fetch(request);
}

