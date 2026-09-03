import { writeFileSync } from "node:fs";
import { lexicographicSortSchema, printSchema } from "graphql";
import { schema } from "../lib/graphql/schema";

const sdl = printSchema(lexicographicSortSchema(schema));
writeFileSync("lib/graphql/schema.graphql", sdl + "\n");
console.log("Written schema.graphql");
