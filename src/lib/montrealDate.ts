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
