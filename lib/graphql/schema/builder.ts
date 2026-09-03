import SchemaBuilder from "@pothos/core";
import type { GraphQLContext } from "./context";

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    UUID: { Input: string; Output: string };
    DateTime: { Input: string; Output: string };
  };
}>({});

// Fields are non-null by default; nullable fields must explicitly opt-in with nullable: true.
// This matches the original SDL's explicit ! conventions.
builder.defaultFieldNullability = false;

builder.queryType();
builder.mutationType();
