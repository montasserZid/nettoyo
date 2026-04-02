import { ChevronDown, ChevronUp } from 'lucide-react';

type Meridiem = 'AM' | 'PM';

type TimeParts = {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
};

function toTimeParts(value: string): TimeParts {
  const [rawHour, rawMinute] = value.split(':');
  const hour24 = Number.parseInt(rawHour ?? '0', 10);
  const minute = Number.parseInt(rawMinute ?? '0', 10);
  const meridiem: Meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour24 % 12;
  return {
    hour12: normalizedHour === 0 ? 12 : normalizedHour,
    minute: Number.isNaN(minute) ? 0 : Math.min(59, Math.max(0, minute)),
    meridiem
  };
}

function fromTimeParts(parts: TimeParts): string {
  const normalizedHour12 = Math.min(12, Math.max(1, parts.hour12));
  const normalizedMinute = Math.min(59, Math.max(0, parts.minute));
  const hour24 = parts.meridiem === 'PM' ? (normalizedHour12 % 12) + 12 : normalizedHour12 % 12;
  return `${String(hour24).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`;
}

export function TimeStepControl({
  value,
  onChange,
  disabled = false
}: {
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
}) {
  const timeParts = toTimeParts(value);

  const update = (patch: Partial<TimeParts>) => {
    onChange(fromTimeParts({ ...timeParts, ...patch }));
  };

  const adjustHour = (delta: number) => {
    const nextHour = ((timeParts.hour12 - 1 + delta + 12) % 12) + 1;
    update({ hour12: nextHour });
  };

  const adjustMinute = (delta: number) => {
    const step = 5;
    const totalMinutes = (timeParts.minute + delta * step + 60) % 60;
    update({ minute: totalMinutes });
  };

  const toggleMeridiem = () => {
    update({ meridiem: timeParts.meridiem === 'AM' ? 'PM' : 'AM' });
  };

  const buttonBase =
    'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#4FC3F7] transition-all hover:border-[#4FC3F7] hover:bg-[#F0FAFF] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E5E7EB] disabled:hover:bg-white';

  return (
    <div
      className={`inline-flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 shadow-sm ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-0.5">
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustHour(1)} aria-label="hour-up">
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <span className="mx-1 min-w-[28px] text-center text-sm font-bold text-[#1A1A2E]">{String(timeParts.hour12).padStart(2, '0')}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustHour(-1)} aria-label="hour-down">
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </div>

      <span className="text-sm font-bold text-[#6B7280]">:</span>

      <div className="flex items-center gap-0.5">
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustMinute(1)} aria-label="minute-up">
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <span className="mx-1 min-w-[28px] text-center text-sm font-bold text-[#1A1A2E]">{String(timeParts.minute).padStart(2, '0')}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={() => adjustMinute(-1)} aria-label="minute-down">
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </div>

      <div className="ml-1 flex items-center gap-0.5 border-l border-[#E5E7EB] pl-2">
        <button type="button" disabled={disabled} className={buttonBase} onClick={toggleMeridiem} aria-label="meridiem-up">
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <span className="mx-1 min-w-[32px] text-center text-xs font-bold tracking-wider text-[#1A1A2E]">{timeParts.meridiem}</span>
        <button type="button" disabled={disabled} className={buttonBase} onClick={toggleMeridiem} aria-label="meridiem-down">
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
