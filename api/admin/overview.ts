import { requireAdmin } from './_auth';

const bookingStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'expired'] as const;
const feeColumns = ['platform_fee_amount', 'platform_fee', 'fee_amount'] as const;

async function countRows(
  supabaseAdmin: any,
  table: string,
  apply?: (query: any) => any
) {
  let query = supabaseAdmin.from(table).select('*', { head: true, count: 'exact' });
  if (apply) query = apply(query);
  const { count, error } = await query;
  if (error) {
    throw new Error(error.message ?? `Unable to count rows for ${table}.`);
  }
  return count ?? 0;
}

async function resolveFeeRevenue(supabaseAdmin: any) {
  for (const column of feeColumns) {
    const probe = await supabaseAdmin.from('bookings').select(column).limit(1);
    if (probe.error) {
      continue;
    }

    const feeRowsRes = await supabaseAdmin
      .from('bookings')
      .select(`${column},status`)
      .in('status', [...bookingStatuses, 'accepted'])
      .not(column, 'is', null)
      .limit(5000);

    if (feeRowsRes.error) {
      continue;
    }

    const rows = (feeRowsRes.data as Array<Record<string, unknown>> | null) ?? [];
    const value = rows.reduce((sum, row) => {
      const next = Number(row[column]);
      return Number.isFinite(next) ? sum + next : sum;
    }, 0);

    return {
      value,
      currency: 'CAD',
      sourceColumn: column,
      capped: rows.length === 5000
    };
  }

  return null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const context = await requireAdmin(req, res);
  if (!context) return;
  const { supabaseAdmin } = context;

  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const [
      totalUsers,
      totalClients,
      totalCleaners,
      totalBookings,
      newUsersThisMonth,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      expiredBookings,
      feeRevenue
    ] = await Promise.all([
      countRows(supabaseAdmin, 'profiles'),
      countRows(supabaseAdmin, 'profiles', (q) => q.eq('role', 'client')),
      countRows(supabaseAdmin, 'profiles', (q) => q.eq('role', 'nettoyeur')),
      countRows(supabaseAdmin, 'bookings'),
      countRows(supabaseAdmin, 'profiles', (q) => q.gte('created_at', monthStart)),
      countRows(supabaseAdmin, 'bookings', (q) => q.eq('status', 'pending')),
      countRows(supabaseAdmin, 'bookings', (q) => q.eq('status', 'confirmed')),
      countRows(supabaseAdmin, 'bookings', (q) => q.eq('status', 'completed')),
      countRows(supabaseAdmin, 'bookings', (q) => q.eq('status', 'cancelled')),
      countRows(supabaseAdmin, 'bookings', (q) => q.eq('status', 'expired')),
      resolveFeeRevenue(supabaseAdmin)
    ]);

    return res.status(200).json({
      stats: {
        totalUsers,
        totalClients,
        totalCleaners,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        expiredBookings,
        newUsersThisMonth,
        platformFeeRevenue: feeRevenue
      }
    });
  } catch (err: unknown) {
    console.error('[API ERROR][admin/overview]', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
