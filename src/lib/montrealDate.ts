const MONTREAL_TIMEZONE = 'America/Toronto';

export function getMontrealToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MONTREAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
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
  const parseDayKey = (dayKey: string) => {
    const [year, month, day] = dayKey.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return Date.UTC(year, month - 1, day);
  };
  const from = parseDayKey(dateValue);
  const to = parseDayKey(montrealToday);
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
