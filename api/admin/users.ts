import { parseBody, requireAdmin } from './_auth.js';

type ListMode = 'clients' | 'cleaners';

function resolveRole(mode: ListMode) {
  return mode === 'cleaners' ? 'nettoyeur' : 'client';
}

function toDisplayName(firstName: string | null, lastName: string | null, email: string | null) {
  const raw = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (raw) return raw;
  return email ?? 'Unknown';
}

export default async function handler(req: any, res: any) {
  try {
    const context = await requireAdmin(req, res);
    if (!context) return;
    const { supabaseAdmin, userId: adminUserId } = context;

    if (req.method === 'GET') {
      const fullUrl = new URL(req.url, 'http://localhost');
      const mode = (fullUrl.searchParams.get('mode') ?? 'clients') as ListMode;
      const role = resolveRole(mode === 'cleaners' ? 'cleaners' : 'clients');
      const search = (fullUrl.searchParams.get('search') ?? '').trim();
      const page = Math.max(1, Number.parseInt(fullUrl.searchParams.get('page') ?? '1', 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(fullUrl.searchParams.get('pageSize') ?? '20', 10) || 20));
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabaseAdmin
        .from('profiles')
        .select('id,email,role,first_name,last_name,city,phone,created_at', { count: 'exact' })
        .eq('role', role)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`
        );
      }

      const profilesRes = await query;
      if (profilesRes.error) {
        return res.status(500).json({
          error: `Unable to load ${mode}.`,
          details: profilesRes.error.message
        });
      }

      const profiles = (profilesRes.data as Array<Record<string, any>> | null) ?? [];
      const ids = profiles.map((profile) => profile.id as string).filter(Boolean);

      const bookingColumn = mode === 'cleaners' ? 'cleaner_id' : 'client_id';
      const bookingRes = ids.length
        ? await supabaseAdmin
            .from('bookings')
            .select(`${bookingColumn},status`)
            .in(bookingColumn, ids)
        : { data: [], error: null };

      if (bookingRes.error) {
        return res.status(500).json({
          error: `Unable to load ${mode} booking stats.`,
          details: bookingRes.error.message
        });
      }

      const bookingRows = (bookingRes.data as Array<Record<string, any>> | null) ?? [];
      const bookingCountMap = new Map<string, number>();
      const completedCountMap = new Map<string, number>();
      bookingRows.forEach((row) => {
        const ownerId = row[bookingColumn];
        if (!ownerId || typeof ownerId !== 'string') return;
        bookingCountMap.set(ownerId, (bookingCountMap.get(ownerId) ?? 0) + 1);
        if (row.status === 'completed') {
          completedCountMap.set(ownerId, (completedCountMap.get(ownerId) ?? 0) + 1);
        }
      });

      const ratingsMap = new Map<string, { total: number; count: number }>();
      if (mode === 'cleaners' && ids.length > 0) {
        const ratingsRes = await supabaseAdmin
          .from('cleaner_client_reviews')
          .select('cleaner_id,rating')
          .in('cleaner_id', ids);
        if (!ratingsRes.error) {
          ((ratingsRes.data as Array<{ cleaner_id: string | null; rating: number | null }> | null) ?? []).forEach((row) => {
            if (!row.cleaner_id || typeof row.rating !== 'number') return;
            const current = ratingsMap.get(row.cleaner_id) ?? { total: 0, count: 0 };
            ratingsMap.set(row.cleaner_id, { total: current.total + row.rating, count: current.count + 1 });
          });
        }
      }

      const cleanerProfileMap = new Map<
        string,
        { services: string[]; zone: string | null }
      >();
      if (mode === 'cleaners' && ids.length > 0) {
        const cleanerProfilesRes = await supabaseAdmin
          .from('cleaner_profiles')
          .select('id,services,service_areas')
          .in('id', ids);
        if (!cleanerProfilesRes.error) {
          ((cleanerProfilesRes.data as Array<{ id: string; services: string[] | null; service_areas: unknown }> | null) ?? []).forEach((row) => {
            const firstArea = Array.isArray(row.service_areas) && row.service_areas.length > 0
              ? (row.service_areas[0] as { zone?: string; name?: string })
              : null;
            cleanerProfileMap.set(row.id, {
              services: Array.isArray(row.services) ? row.services : [],
              zone: firstArea?.zone ?? firstArea?.name ?? null
            });
          });
        }
      }

      const authRows = await Promise.all(
        ids.map(async (id) => {
          const authRes = await supabaseAdmin.auth.admin.getUserById(id);
          if (authRes.error || !authRes.data.user) {
            return [id, { active: true }] as const;
          }
          const bannedUntil = authRes.data.user.banned_until;
          const active = !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
          return [id, { active, bannedUntil: bannedUntil ?? null }] as const;
        })
      );
      const authMap = new Map(authRows);

      const items = profiles.map((profile) => {
        const id = profile.id as string;
        const auth = authMap.get(id) ?? { active: true, bannedUntil: null };
        const cleanerData = cleanerProfileMap.get(id) ?? { services: [], zone: null };
        const rating = ratingsMap.get(id);
        return {
          id,
          email: profile.email ?? null,
          name: toDisplayName(profile.first_name ?? null, profile.last_name ?? null, profile.email ?? null),
          firstName: profile.first_name ?? null,
          lastName: profile.last_name ?? null,
          city: profile.city ?? null,
          phone: profile.phone ?? null,
          createdAt: profile.created_at ?? null,
          role: profile.role ?? null,
          active: auth.active,
          bannedUntil: auth.bannedUntil ?? null,
          bookingsCount: bookingCountMap.get(id) ?? 0,
          completedJobs: completedCountMap.get(id) ?? 0,
          ratingAverage: rating && rating.count > 0 ? rating.total / rating.count : null,
          ratingCount: rating?.count ?? 0,
          services: cleanerData.services,
          zone: cleanerData.zone
        };
      });

      return res.status(200).json({
        items,
        page,
        pageSize,
        total: profilesRes.count ?? 0,
        totalPages: Math.max(1, Math.ceil((profilesRes.count ?? 0) / pageSize))
      });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const userId = typeof body.userId === 'string' ? body.userId : '';
      const action = typeof body.action === 'string' ? body.action : '';
      if (!userId || !action) {
        return res.status(400).json({ error: 'userId and action are required.' });
      }

      if (userId === adminUserId) {
        return res.status(400).json({ error: 'You cannot change your own admin account state.' });
      }

      const profileRes = await supabaseAdmin
        .from('profiles')
        .select('id,role')
        .eq('id', userId)
        .maybeSingle();

      if (profileRes.error || !profileRes.data) {
        return res.status(404).json({ error: 'Target user not found.' });
      }

      if (profileRes.data.role === 'admin') {
        return res.status(400).json({ error: 'Admin accounts cannot be deactivated from this panel.' });
      }

      if (action === 'deactivate') {
        const updateRes = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: '876000h'
        });
        if (updateRes.error) {
          return res.status(500).json({ error: 'Unable to deactivate user.', details: updateRes.error.message });
        }
        return res.status(200).json({ success: true });
      }

      if (action === 'reactivate') {
        const updateRes = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: 'none'
        });
        if (updateRes.error) {
          return res.status(500).json({ error: 'Unable to reactivate user.', details: updateRes.error.message });
        }
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unsupported action.' });
    }

    if (req.method === 'DELETE') {
      const body = parseBody(req);
      const userId = typeof body.userId === 'string' ? body.userId : '';
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      if (userId === adminUserId) {
        return res.status(400).json({ error: 'You cannot delete your own admin account.' });
      }

      const profileRes = await supabaseAdmin
        .from('profiles')
        .select('id,role')
        .eq('id', userId)
        .maybeSingle();

      if (profileRes.error || !profileRes.data) {
        return res.status(404).json({ error: 'Target user not found.' });
      }

      if (profileRes.data.role === 'admin') {
        return res.status(400).json({ error: 'Admin accounts cannot be deleted from this panel.' });
      }

      const deleteRes = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteRes.error) {
        return res.status(500).json({ error: 'Unable to delete user.', details: deleteRes.error.message });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: unknown) {
    console.error('[API ERROR][admin/users]', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
