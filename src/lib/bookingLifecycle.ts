import supabase from './supabase';
import { isPendingBookingExpired } from './montrealDate';

type BookingForExpiry = {
  id: string;
  status: string;
  scheduled_at: string | null;
};

export function shouldShowBookingContact(scheduledAt: string | null, now = new Date()) {
  if (!scheduledAt) return false;
  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) return false;
  const diffMs = scheduledDate.getTime() - now.getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= twentyFourHoursMs;
}

export function getExpirablePendingBookingIds(rows: BookingForExpiry[], now = new Date()) {
  return rows
    .filter((row) => row.status === 'pending' && row.scheduled_at && isPendingBookingExpired(row.scheduled_at, now, 2))
    .map((row) => row.id);
}

export async function expirePendingBookingsByActor(
  actorField: 'client_id' | 'cleaner_id',
  actorId: string,
  rows: BookingForExpiry[]
) {
  const ids = getExpirablePendingBookingIds(rows);
  if (ids.length === 0) return ids;

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'expired' })
    .in('id', ids)
    .eq(actorField, actorId)
    .eq('status', 'pending');

  if (error) {
    console.error('Expire pending bookings update error:', { actorField, actorId, ids, error });
    return [];
  }

  return ids;
}
