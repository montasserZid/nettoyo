import { createClient } from '@supabase/supabase-js';

type AdminProfile = {
  id: string;
  role: string | null;
};

export type AdminContext = {
  supabaseAdmin: ReturnType<typeof createClient>;
  userId: string;
};

function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('[admin env]', {
    supabaseUrl: Boolean(supabaseUrl),
    serviceRoleKey: Boolean(serviceRoleKey)
  });

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      error:
        'Missing required server env vars (SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).'
    } as const;
  }

  return {
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })
  } as const;
}

export async function requireAdmin(req: any, res: any): Promise<AdminContext | null> {
  const svc = getServiceClient();
  if ('error' in svc) {
    res.status(500).json({ error: svc.error });
    return null;
  }

  const rawAuthHeader = req.headers?.authorization ?? req.headers?.Authorization;
  const authHeader = typeof rawAuthHeader === 'string' ? rawAuthHeader : '';
  const hasBearer = authHeader.toLowerCase().startsWith('bearer ');
  if (!hasBearer) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return null;
  }
  const token = authHeader.slice('bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token.' });
    return null;
  }

  const supabaseAdmin = svc.client;
  const userRes = await supabaseAdmin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return null;
  }

  const userId = userRes.data.user.id;
  const roleRes = await supabaseAdmin
    .from('profiles')
    .select('id,role')
    .eq('id', userId)
    .maybeSingle();

  if (roleRes.error || !roleRes.data) {
    res.status(403).json({ error: 'Unable to validate admin role.' });
    return null;
  }

  const profile = roleRes.data as AdminProfile;
  if (profile.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return null;
  }

  return { supabaseAdmin, userId };
}

export function parseBody(req: any) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body as Record<string, unknown>;
}
