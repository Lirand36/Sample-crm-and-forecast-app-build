// Date-only values ("YYYY-MM-DD"), calendar-day arithmetic, no clock and no Date object.
// Day numbers use the proleptic Gregorian calendar (days since 1970-01-01).

export type IsoDate = string & { readonly __brand: "IsoDate" };

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z: number): [number, number, number] {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return [y, m, d];
}

function daysInMonth(y: number, m: number): number {
  return daysFromCivil(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - daysFromCivil(y, m, 1);
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isoDate(value: string): IsoDate {
  if (!isIsoDate(value)) throw new Error(`Not a valid date-only value: ${value}`);
  return value;
}

export function toDayNumber(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return daysFromCivil(y, m, d);
}

export function fromDayNumber(day: number): IsoDate {
  const [y, m, d] = civilFromDays(day);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` as IsoDate;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) throw new Error("Durations are whole calendar days");
  return fromDayNumber(toDayNumber(date) + days);
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxDate(first: IsoDate, ...rest: IsoDate[]): IsoDate {
  return rest.reduce((acc, d) => (d > acc ? d : acc), first);
}

export function minDate(first: IsoDate, ...rest: IsoDate[]): IsoDate {
  return rest.reduce((acc, d) => (d < acc ? d : acc), first);
}

/** Inclusive on both ends: used for quarters (QE is inclusive). */
export function isWithin(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end;
}

/** Half-open interval [start, end) used for blocked periods. */
export interface HalfOpenInterval {
  start: IsoDate;
  end: IsoDate | null; // null = no stated end
}

export function formatDisplayDate(date: IsoDate): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${months[m - 1]} ${d}, ${y}`;
}
