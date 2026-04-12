import { parseBody, requireAdmin } from './_auth.js';

const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'expired', 'accepted'] as const;

function asIsoDateStart(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

export default async function handler(req: any, res: any) {
  try {
    const context = await requireAdmin(req, res);
    if (!context) return;
    const { supabaseAdmin } = context;

    if (req.method === 'GET') {
      const fullUrl = new URL(req.url, 'http://localhost');
      const page = Math.max(1, Number.parseInt(fullUrl.searchParams.get('page') ?? '1', 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(fullUrl.searchParams.get('pageSize') ?? '20', 10) || 20));
      const status = (fullUrl.searchParams.get('status') ?? '').trim();
      const city = (fullUrl.searchParams.get('city') ?? '').trim();
      const date = (fullUrl.searchParams.get('date') ?? '').trim();
      const searchId = (fullUrl.searchParams.get('bookingId') ?? '').trim();

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabaseAdmin
        .from('bookings')
        .select(
          'id,client_id,cleaner_id,service_type,scheduled_at,status,created_at,spaces(city),client:profiles!bookings_client_id_fkey(first_name,last_name,email),cleaner:profiles!bookings_cleaner_id_fkey(first_name,last_name,email)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (city) {
        query = query.ilike('spaces.city', `%${city}%`);
      }

      if (searchId) {
        query = query.eq('id', searchId);
      }

      if (date) {
        const start = asIsoDateStart(date);
        if (start) {
          const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
          query = query.gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString());
        }
      }

      const listRes = await query;
      if (listRes.error) {
        return res.status(500).json({
          error: 'Unable to load bookings.',
          details: listRes.error.message
        });
      }

      const rows = (listRes.data as Array<Record<string, any>> | null) ?? [];
      const items = rows.map((row) => {
        const client = row.client ?? {};
        const cleaner = row.cleaner ?? {};
        const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ').trim() || null;
        const cleanerName = [cleaner.first_name, cleaner.last_name].filter(Boolean).join(' ').trim() || null;
        return {
          id: row.id,
          serviceType: row.service_type ?? null,
          scheduledAt: row.scheduled_at ?? null,
          status: row.status ?? null,
          createdAt: row.created_at ?? null,
          city: row.spaces?.city ?? null,
          client: {
            id: row.client_id ?? null,
            name: clientName,
            email: client.email ?? null
          },
          cleaner: {
            id: row.cleaner_id ?? null,
            name: cleanerName,
            email: cleaner.email ?? null
          }
        };
      });

      return res.status(200).json({
        items,
        page,
        pageSize,
        total: listRes.count ?? 0,
        totalPages: Math.max(1, Math.ceil((listRes.count ?? 0) / pageSize))
      });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
      const status = typeof body.status === 'string' ? body.status : '';

      if (!bookingId || !status) {
        return res.status(400).json({ error: 'bookingId and status are required.' });
      }

      if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
        return res.status(400).json({ error: 'Unsupported booking status.' });
      }

      const updateRes = await supabaseAdmin
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
        .select('id,status')
        .maybeSingle();

      if (updateRes.error) {
        return res.status(500).json({
          error: 'Unable to update booking status.',
          details: updateRes.error.message
        });
      }

      return res.status(200).json({ success: true, booking: updateRes.data ?? { id: bookingId, status } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: unknown) {
    console.error('[API ERROR][admin/bookings]', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
