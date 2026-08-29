// Convert a JS Date to the Sustained/temporal PlainDateTime the ORM expects for
// `timestamp` columns. Timestamps are stored as UTC (no timezone), so we map
// from the Date's UTC components.
export function toPlainDateTime(d: Date): Temporal.PlainDateTime {
  return new Temporal.PlainDateTime(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  );
}