import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./lib/graphql/schema.graphql",
  documents: ["./app/**/*.tsx"],
  generates: {
    "./lib/graphql/generated/": {
      preset: "client",
      config: {
        useTypeImports: true,
        avoidOptionals: false,
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
