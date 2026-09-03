import { builder } from "../builder";

builder.scalarType("UUID", {
  description: "A universally unique identifier (UUID) string",
  serialize: (value) => value,
  parseValue: (value) => value as string,
});

builder.scalarType("DateTime", {
  description: "An ISO-8601 formatted date or datetime string",
  serialize: (value) => value,
  parseValue: (value) => value as string,
});
