import { ChevronDown, ChevronUp, Clock3, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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

function toDisplayLabel(parts: TimeParts): string {
  return `${parts.hour12}:${String(parts.minute).padStart(2, '0')} ${parts.meridiem}`;
}

function normalizeModalMinute(minute: number): 0 | 30 {
  return minute >= 15 && minute < 45 ? 30 : 0;
}

function adjustHour(current: number, delta: number) {
  return ((current - 1 + delta + 12) % 12) + 1;
}

function nextMinute(current: 0 | 30, delta: number): 0 | 30 {
  if (delta > 0) {
    return current === 0 ? 30 : 0;
  }
  return current === 30 ? 0 : 30;
}

type TimePickerFieldProps = {
  value: string;
  onChange: (nextValue: string) => void;
  label: string;
  disabled?: boolean;
};

export function TimePickerField({ value, onChange, label, disabled = false }: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimeParts>(() => {
    const parsed = toTimeParts(value);
    return { ...parsed, minute: normalizeModalMinute(parsed.minute) };
  });

  const displayParts = useMemo(() => toTimeParts(value), [value]);
  const displayValue = useMemo(() => toDisplayLabel(displayParts), [displayParts]);

  useEffect(() => {
    if (!open) return;
    const parsed = toTimeParts(value);
    setDraft({ ...parsed, minute: normalizeModalMinute(parsed.minute) });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const controlBase =
    'inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#4FC3F7] transition-all hover:border-[#4FC3F7] hover:bg-[#F0FAFF] active:scale-95';

  useBodyScrollLock(open);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:border-[#BFE9FB] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A1A2E]">
          <Clock3 size={14} className="text-[#4FC3F7]" />
          {displayValue}
        </span>
        <ChevronDown size={16} className="text-[#6B7280]" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[3100] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/45 px-4 py-4 sm:items-center">
          <div className="w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-[0_24px_60px_rgba(17,24,39,0.35)] max-h-[calc(100dvh-2rem)]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{label}</p>
                <p className="mt-1 text-base font-bold text-[#1A1A2E]">{toDisplayLabel(draft)}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F7F7]"
                aria-label="close-time-picker"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">Hour</p>
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <button type="button" className={controlBase} onClick={() => setDraft((cur) => ({ ...cur, hour12: adjustHour(cur.hour12, 1) }))}>
                      <ChevronUp size={14} strokeWidth={2.5} />
                    </button>
                    <span className="min-w-[56px] rounded-lg bg-white px-3 py-2 text-lg font-bold text-[#1A1A2E]">{draft.hour12}</span>
                    <button type="button" className={controlBase} onClick={() => setDraft((cur) => ({ ...cur, hour12: adjustHour(cur.hour12, -1) }))}>
                      <ChevronDown size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">Min</p>
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <button type="button" className={controlBase} onClick={() => setDraft((cur) => ({ ...cur, minute: nextMinute(normalizeModalMinute(cur.minute), 1) }))}>
                      <ChevronUp size={14} strokeWidth={2.5} />
                    </button>
                    <span className="min-w-[56px] rounded-lg bg-white px-3 py-2 text-lg font-bold text-[#1A1A2E]">{String(normalizeModalMinute(draft.minute)).padStart(2, '0')}</span>
                    <button type="button" className={controlBase} onClick={() => setDraft((cur) => ({ ...cur, minute: nextMinute(normalizeModalMinute(cur.minute), -1) }))}>
                      <ChevronDown size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B7280]">AM/PM</p>
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <button type="button" className={controlBase} onClick={() => setDraft((cur) => ({ ...cur, meridiem: cur.meridiem === 'AM' ? 'PM' : 'AM' }))}>
                      <ChevronUp size={14} strokeWidth={2.5} />
                    </button>
                    <span className="min-w-[56px] rounded-lg bg-white px-3 py-2 text-lg font-bold text-[#1A1A2E]">{draft.meridiem}</span>
                    <button type="button" className={controlBase} onClick={() => setDraft((cur) => ({ ...cur, meridiem: cur.meridiem === 'AM' ? 'PM' : 'AM' }))}>
                      <ChevronDown size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#FAFBFC] px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const safeDraft = { ...draft, minute: normalizeModalMinute(draft.minute) };
                  onChange(fromTimeParts(safeDraft));
                  setOpen(false);
                }}
                className="rounded-full bg-[#4FC3F7] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3FAAD4]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
