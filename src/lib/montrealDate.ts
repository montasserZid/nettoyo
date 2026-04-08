const MONTREAL_TIMEZONE = 'America/Montreal';

type MontrealDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseDayKey(dayKey: string) {
  const match = dayKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseTimeKey(timeKey: string) {
  const match = timeKey.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function getMontrealDateParts(value: Date | string): MontrealDateParts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MONTREAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? NaN);
  const parsed = {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second')
  };
  if (
    !Number.isFinite(parsed.year) ||
    !Number.isFinite(parsed.month) ||
    !Number.isFinite(parsed.day) ||
    !Number.isFinite(parsed.hour) ||
    !Number.isFinite(parsed.minute) ||
    !Number.isFinite(parsed.second)
  ) {
    return null;
  }
  return parsed;
}

function getMontrealOffsetMinutes(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MONTREAL_TIMEZONE,
    timeZoneName: 'shortOffset',
    hour: '2-digit'
  }).formatToParts(value);
  const tzName = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  const match = tzName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? '0');
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return sign * (hours * 60 + minutes);
}

function roundUpToMinuteStep(totalMinutes: number, stepMinutes: number) {
  if (!Number.isFinite(totalMinutes) || !Number.isFinite(stepMinutes) || stepMinutes <= 0) return null;
  return Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
}

function toUtcDayMs(dayKey: string) {
  const parsed = parseDayKey(dayKey);
  if (!parsed) return null;
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
}

export function getMontrealToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MONTREAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function getMontrealNowDateTime() {
  const nowParts = getMontrealDateParts(new Date());
  if (!nowParts) return null;
  return {
    dateKey: `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`,
    timeKey: `${String(nowParts.hour).padStart(2, '0')}:${String(nowParts.minute).padStart(2, '0')}`,
    ...nowParts
  };
}

export function toMontrealDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MONTREAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function isTodayOrFutureInMontreal(value: Date | string, montrealToday = getMontrealToday()) {
  const dateValue = toMontrealDate(value);
  if (!dateValue) {
    return false;
  }
  return dateValue >= montrealToday;
}

export function isPastInMontreal(value: Date | string, montrealToday = getMontrealToday()) {
  const dateValue = toMontrealDate(value);
  if (!dateValue) {
    return false;
  }
  return dateValue < montrealToday;
}

export function daysSinceMontrealDate(value: Date | string, montrealToday = getMontrealToday()) {
  const dateValue = toMontrealDate(value);
  if (!dateValue) return null;
  const from = toUtcDayMs(dateValue);
  const to = toUtcDayMs(montrealToday);
  if (from === null || to === null) return null;
  const diff = to - from;
  if (!Number.isFinite(diff)) return null;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function toValidDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function hoursUntil(value: Date | string, now = new Date()) {
  const target = toValidDate(value);
  if (!target) {
    return null;
  }
  const diffMs = target.getTime() - now.getTime();
  if (!Number.isFinite(diffMs)) {
    return null;
  }
  return diffMs / (60 * 60 * 1000);
}

export function hasAtLeastHoursUntil(value: Date | string, minimumHours: number, now = new Date()) {
  const hours = hoursUntil(value, now);
  if (hours === null) {
    return false;
  }
  return hours >= minimumHours;
}

export function isWithinHoursBefore(value: Date | string, hoursWindow: number, now = new Date()) {
  const hours = hoursUntil(value, now);
  if (hours === null) {
    return false;
  }
  return hours >= 0 && hours <= hoursWindow;
}

export function toMontrealDateTime(value: Date | string) {
  const parts = getMontrealDateParts(value);
  if (!parts) return null;
  return {
    ...parts,
    dateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    timeKey: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
  };
}

export function isSameMontrealDay(a: Date | string, b: Date | string) {
  const first = toMontrealDate(a);
  const second = toMontrealDate(b);
  if (!first || !second) return false;
  return first === second;
}

export function combineMontrealDateTimeToUtc(dateKey: string, timeKey: string) {
  const day = parseDayKey(dateKey);
  const time = parseTimeKey(timeKey);
  if (!day || !time) return null;

  let utcMs = Date.UTC(day.year, day.month - 1, day.day, time.hour, time.minute, 0, 0);

  // Resolve Montreal local datetime -> UTC while honoring DST offset.
  for (let index = 0; index < 3; index += 1) {
    const candidate = new Date(utcMs);
    const offsetMinutes = getMontrealOffsetMinutes(candidate);
    if (offsetMinutes === null) return null;
    const adjustedUtcMs = Date.UTC(day.year, day.month - 1, day.day, time.hour, time.minute, 0, 0) - offsetMinutes * 60_000;
    if (adjustedUtcMs === utcMs) break;
    utcMs = adjustedUtcMs;
  }

  const resolved = new Date(utcMs);
  if (Number.isNaN(resolved.getTime())) return null;
  return resolved;
}

export function getMinimumSameDayBookingTime(minimumLeadHours = 2, stepMinutes = 30, now = new Date()) {
  const nowMontreal = toMontrealDateTime(now);
  if (!nowMontreal) return null;
  const totalMinutes = nowMontreal.hour * 60 + nowMontreal.minute + Math.max(0, minimumLeadHours) * 60;
  const roundedMinutes = roundUpToMinuteStep(totalMinutes, stepMinutes);
  if (roundedMinutes === null || roundedMinutes >= 24 * 60) return null;
  const hour = Math.floor(roundedMinutes / 60);
  const minute = roundedMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isDateTodayInMontreal(dateKey: string, now = new Date()) {
  const today = toMontrealDate(now);
  return Boolean(today && dateKey === today);
}

export function hasMinimumLeadHoursFromMontrealDateTime(
  dateKey: string,
  timeKey: string,
  minimumLeadHours: number,
  now = new Date()
) {
  const scheduled = combineMontrealDateTimeToUtc(dateKey, timeKey);
  if (!scheduled) return false;
  const diffMs = scheduled.getTime() - now.getTime();
  return diffMs >= minimumLeadHours * 60 * 60 * 1000;
}

export function isWithinHoursBeforeMontreal(
  scheduledAt: Date | string,
  hoursWindow: number,
  now = new Date()
) {
  return isWithinHoursBefore(scheduledAt, hoursWindow, now);
}

export function isPendingBookingExpired(scheduledAt: Date | string, now = new Date(), cutoffHours = 2) {
  const target = toValidDate(scheduledAt);
  if (!target) return false;
  const cutoffMs = cutoffHours * 60 * 60 * 1000;
  return target.getTime() - now.getTime() < cutoffMs;
}
