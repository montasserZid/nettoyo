import { ChevronLeft, ChevronRight } from 'lucide-react';

type PaginationLabels = {
  previous: string;
  next: string;
  page: string;
};

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels: PaginationLabels;
  className?: string;
};

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  labels,
  className
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={`mt-5 flex items-center justify-center gap-2 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={labels.previous}
        className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#1A1A2E] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
      >
        <ChevronLeft size={14} />
        <span>{labels.previous}</span>
      </button>
      <span className="min-w-[84px] text-center text-xs font-semibold text-[#6B7280] sm:text-sm">
        {labels.page} {page}/{totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={labels.next}
        className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#1A1A2E] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
      >
        <span>{labels.next}</span>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
