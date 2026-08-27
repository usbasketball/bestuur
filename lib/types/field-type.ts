export const FIELD_TYPES = ["CENTER_COURT", "VELD_1", "VELD_2", "VELD_3"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const FIELD_NAME_TO_TYPE: Record<string, FieldType> = {
  "Center Court": "CENTER_COURT",
  "Veld 1": "VELD_1",
  "Veld 2": "VELD_2",
  "Veld 3": "VELD_3",
};

const FIELD_TYPE_TO_LABEL: Record<FieldType, string> = {
  CENTER_COURT: "Center Court",
  VELD_1: "Veld 1",
  VELD_2: "Veld 2",
  VELD_3: "Veld 3",
};

export function mapFieldType(name: string | null | undefined): FieldType | null {
  if (!name) return null;
  return FIELD_NAME_TO_TYPE[name] ?? null;
}

export function formatFieldType(type: string | null | undefined): string | null {
  if (!type) return null;
  return FIELD_TYPE_TO_LABEL[type as FieldType] ?? type;
}
