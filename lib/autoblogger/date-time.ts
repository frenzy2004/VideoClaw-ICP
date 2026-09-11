const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/;

export function isStrictIsoDateTime(value: string): boolean {
  const match = value.match(ISO_DATE_TIME);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offsetHour = '00', offsetMinute = '00'] = match;
  const parts = [year, month, day, hour, minute, second, offsetHour, offsetMinute].map(Number);
  const [y, m, d, h, min, sec, offsetH, offsetMin] = parts;
  if (h > 23 || min > 59 || sec > 59 || offsetH > 23 || offsetMin > 59) return false;
  const calendarDate = new Date(Date.UTC(y, m - 1, d));
  if (
    calendarDate.getUTCFullYear() !== y
    || calendarDate.getUTCMonth() !== m - 1
    || calendarDate.getUTCDate() !== d
  ) return false;
  return Number.isFinite(Date.parse(value));
}

export function isoDateTimeToDateOnly(value: string): string {
  if (!isStrictIsoDateTime(value)) throw new Error('Value must be a strict ISO date-time.');
  return new Date(value).toISOString().slice(0, 10);
}
