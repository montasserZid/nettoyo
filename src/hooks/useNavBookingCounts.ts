import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { expirePendingBookingsByActor } from '../lib/bookingLifecycle';
import { getMontrealToday, isPastInMontreal } from '../lib/montrealDate';
import supabase from '../lib/supabase';

type CleanerBookingPreview = {
  id: string;
  status: string;
  scheduled_at: string | null;
};

type HistoryBookingPreview = {
  id: string;
  status: string;
  scheduled_at: string | null;
};

function isAcceptedStatus(status: string) {
  return status === 'confirmed' || status === 'accepted';
}

export function useNavBookingCounts() {
  const { user, isCleaner, isClient } = useAuth();
  const [upcomingBookingCount, setUpcomingBookingCount] = useState<number | null>(null);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [historyPendingCount, setHistoryPendingCount] = useState(0);

  useEffect(() => {
    if (!user?.id || !isCleaner()) {
      setUpcomingBookingCount(null);
      setPendingBookingCount(0);
      return;
    }

    let active = true;
    const loadCleanerBookingStats = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id,status,scheduled_at')
        .eq('cleaner_id', user.id)
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at', { ascending: true });

      if (!active) return;
      if (error) {
        console.error('Navbar cleaner bookings fetch error:', error);
        setUpcomingBookingCount(0);
        setPendingBookingCount(0);
        return;
      }

      const now = new Date();
      const rows = (data as CleanerBookingPreview[] | null) ?? [];
      const expiredIds = await expirePendingBookingsByActor('cleaner_id', user.id, rows);
      const upcoming = rows.filter((booking) => {
        if (!booking.scheduled_at) return false;
        if (expiredIds.includes(booking.id)) return false;
        const scheduled = new Date(booking.scheduled_at);
        if (Number.isNaN(scheduled.getTime())) return false;
        return scheduled.getTime() >= now.getTime();
      });

      const pending = upcoming.filter((booking) => booking.status === 'pending').length;
      const accepted = upcoming.filter((booking) => isAcceptedStatus(booking.status)).length;

      setPendingBookingCount(pending);
      setUpcomingBookingCount(pending + accepted);
    };

    void loadCleanerBookingStats();

    const channel = supabase
      .channel(`navbar-cleaner-bookings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `cleaner_id=eq.${user.id}`
        },
        () => {
          void loadCleanerBookingStats();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [isCleaner, user?.id]);

  useEffect(() => {
    if (!user?.id || (!isCleaner() && !isClient())) {
      setHistoryPendingCount(0);
      return;
    }

    let active = true;
    const loadHistoryPendingCount = async () => {
      const roleKey = isCleaner() ? 'cleaner_id' : 'client_id';
      const reviewTable = isCleaner() ? 'cleaner_client_reviews' : 'client_cleaner_reviews';

      const bookingRes = await supabase
        .from('bookings')
        .select('id,status,scheduled_at')
        .eq(roleKey, user.id)
        .in('status', ['completed', 'confirmed', 'accepted']);

      if (!active) return;
      if (bookingRes.error) {
        console.error('Navbar history pending bookings fetch error:', bookingRes.error);
        setHistoryPendingCount(0);
        return;
      }

      const montrealToday = getMontrealToday();
      const pastIds = (((bookingRes.data as HistoryBookingPreview[] | null) ?? [])
        .filter((row) => row.scheduled_at && isPastInMontreal(row.scheduled_at, montrealToday))
        .map((row) => row.id));

      if (pastIds.length === 0) {
        setHistoryPendingCount(0);
        return;
      }

      const reviewRes = await supabase
        .from(reviewTable)
        .select('booking_id')
        .eq(roleKey, user.id)
        .in('booking_id', pastIds);

      if (!active) return;
      if (reviewRes.error) {
        console.error('Navbar history pending reviews fetch error:', reviewRes.error);
        setHistoryPendingCount(pastIds.length);
        return;
      }

      const reviewed = new Set((((reviewRes.data as Array<{ booking_id: string }> | null) ?? []).map((row) => row.booking_id)));
      setHistoryPendingCount(pastIds.filter((id) => !reviewed.has(id)).length);
    };

    const onHistoryFollowupUpdated = () => {
      void loadHistoryPendingCount();
    };

    void loadHistoryPendingCount();
    window.addEventListener('history-followup-updated', onHistoryFollowupUpdated);
    return () => {
      active = false;
      window.removeEventListener('history-followup-updated', onHistoryFollowupUpdated);
    };
  }, [isCleaner, isClient, user?.id]);

  return {
    upcomingBookingCount,
    pendingBookingCount,
    historyPendingCount
  };
}
