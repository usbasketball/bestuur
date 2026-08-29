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

// Parse an ISO date-time string into the wall-clock PlainDateTime in UTC that
// the ORM expects for `timestamp` columns. FOYS returns UTC timestamps with a
// "Z" suffix (e.g. "2026-09-13T00:00:00Z"), which Temporal.PlainDateTime
// rejects, so strings carrying a timezone/offset go through Instant first.
export function toPlainDateTimeFromIso(iso: string): Temporal.PlainDateTime {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(iso)) {
    return Temporal.Instant.from(iso).toZonedDateTimeISO("UTC").toPlainDateTime();
  }
  return Temporal.PlainDateTime.from(iso);
}