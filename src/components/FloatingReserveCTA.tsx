import { CalendarPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { AppRoute } from '../i18n/routes';

const ENABLE_FLOATING_RESERVE_CTA_EXPERIMENT = true;
const DISMISSED_KEY = 'nettoyo_floating_reserve_cta_dismissed_v1';
const HINT_SEEN_KEY = 'nettoyo_floating_reserve_cta_hint_seen_v1';
const SWIPE_DISMISS_THRESHOLD = 68;
const SWIPE_DETECT_THRESHOLD = 10;

const ALLOWED_ROUTES: AppRoute[] = [
  'clientDashboard',
  'clientReservations',
  'clientHistory',
  'clientAddSpace'
];

function getHintByLanguage(language: 'fr' | 'en' | 'es') {
  if (language === 'fr') return 'Glisser pour masquer';
  if (language === 'es') return 'Desliza para ocultar';
  return 'Swipe to hide';
}

function getLabelByLanguage(language: 'fr' | 'en' | 'es') {
  if (language === 'fr') return 'Reserver';
  if (language === 'es') return 'Reservar';
  return 'Book';
}

export function FloatingReserveCTA() {
  const { route, language, navigateTo } = useLanguage();
  const { user, isClient } = useAuth();

  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const pointerRef = useRef<{ id: number; startX: number; startY: number } | null>(null);
  const movedRef = useRef(false);
  const suppressTapRef = useRef(false);

  useEffect(() => {
    if (!ENABLE_FLOATING_RESERVE_CTA_EXPERIMENT) return;
    if (typeof window === 'undefined') return;

    const syncMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 767.98px)').matches);
    };

    syncMobile();
    window.addEventListener('resize', syncMobile);
    return () => window.removeEventListener('resize', syncMobile);
  }, []);

  useEffect(() => {
    if (!ENABLE_FLOATING_RESERVE_CTA_EXPERIMENT) return;
    if (typeof window === 'undefined') return;
    setDismissed(window.localStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  useEffect(() => {
    if (!ENABLE_FLOATING_RESERVE_CTA_EXPERIMENT) return;
    if (typeof window === 'undefined') return;
    if (!isMobile || dismissed) return;
    if (!user || !isClient()) return;
    if (!ALLOWED_ROUTES.includes(route)) return;

    const seen = window.localStorage.getItem(HINT_SEEN_KEY) === '1';
    if (seen) return;

    setShowHint(true);
    const timer = window.setTimeout(() => {
      setShowHint(false);
      window.localStorage.setItem(HINT_SEEN_KEY, '1');
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [dismissed, isClient, isMobile, route, user]);

  const shouldRender = useMemo(() => {
    if (!ENABLE_FLOATING_RESERVE_CTA_EXPERIMENT) return false;
    if (!isMobile) return false;
    if (dismissed) return false;
    if (!user || !isClient()) return false;
    if (!ALLOWED_ROUTES.includes(route)) return false;
    return true;
  }, [dismissed, isClient, isMobile, route, user]);

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISSED_KEY, '1');
      window.localStorage.setItem(HINT_SEEN_KEY, '1');
    }
    setShowHint(false);
    setDismissed(true);
    setTranslate({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const clearHintIfVisible = () => {
    if (showHint) {
      setShowHint(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HINT_SEEN_KEY, '1');
      }
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
    movedRef.current = false;
    suppressTapRef.current = false;
    setIsDragging(true);
    clearHintIfVisible();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointerRef.current || pointerRef.current.id !== event.pointerId) return;
    const dx = event.clientX - pointerRef.current.startX;
    const dy = event.clientY - pointerRef.current.startY;
    const clampedX = Math.max(0, dx);
    const clampedY = Math.max(0, dy);
    setTranslate({ x: clampedX, y: clampedY });
    if (clampedX > SWIPE_DETECT_THRESHOLD || clampedY > SWIPE_DETECT_THRESHOLD) {
      movedRef.current = true;
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointerRef.current || pointerRef.current.id !== event.pointerId) return;
    const dx = translate.x;
    const dy = translate.y;
    pointerRef.current = null;
    setIsDragging(false);

    if (dx >= SWIPE_DISMISS_THRESHOLD || dy >= SWIPE_DISMISS_THRESHOLD) {
      suppressTapRef.current = true;
      dismiss();
      return;
    }

    setTranslate({ x: 0, y: 0 });
  };

  const handlePointerCancel = () => {
    pointerRef.current = null;
    setIsDragging(false);
    setTranslate({ x: 0, y: 0 });
  };

  const handleTap = () => {
    if (suppressTapRef.current || movedRef.current) {
      suppressTapRef.current = false;
      movedRef.current = false;
      return;
    }
    clearHintIfVisible();
    navigateTo('clientReservation');
  };

  if (!shouldRender) return null;

  return (
    <div className="pointer-events-none fixed bottom-[calc(5.9rem+env(safe-area-inset-bottom))] right-4 z-[75] md:hidden">
      {showHint ? (
        <div className="mb-2 ml-auto w-fit rounded-full bg-[#1A1A2E]/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(17,24,39,0.2)]">
          {getHintByLanguage(language)}
        </div>
      ) : null}
      <button
        type="button"
        aria-label={getLabelByLanguage(language)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleTap}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#4FC3F7] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(79,195,247,0.38)] transition-[transform,opacity] duration-200 ease-out active:scale-[0.98]"
        style={{
          transform: `translate3d(${translate.x}px, ${translate.y}px, 0)`,
          opacity: isDragging ? 0.92 : 1,
          transition: isDragging ? 'none' : 'transform 220ms ease, opacity 220ms ease'
        }}
      >
        <CalendarPlus size={16} />
        <span>{getLabelByLanguage(language)}</span>
      </button>
    </div>
  );
}
