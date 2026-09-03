import { createYoga } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";
import { getAuthContext, requireAuthenticated } from "@/lib/api-auth";

const yoga = createYoga({
  schema,
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

