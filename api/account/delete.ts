import { createClient } from '@supabase/supabase-js';

type StorageObject = {
  name: string;
  id?: string;
};

async function removeUserStorageObjects(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
  userId: string
) {
  let removed = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const listRes = await supabaseAdmin.storage
      .from(bucket)
      .list(userId, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

    if (listRes.error) {
      console.error('[account-delete] storage list error', listRes.error);
      break;
    }

    const rows = (listRes.data as StorageObject[] | null) ?? [];
    if (rows.length === 0) break;

    const filePaths = rows
      .filter((row) => Boolean(row.name) && row.name !== '.emptyFolderPlaceholder')
      .map((row) => `${userId}/${row.name}`);

    if (filePaths.length > 0) {
      const removeRes = await supabaseAdmin.storage.from(bucket).remove(filePaths);
      if (removeRes.error) {
        console.error('[account-delete] storage remove error', removeRes.error);
      } else {
        removed += filePaths.length;
      }
    }

    if (rows.length < limit) break;
    offset += limit;
  }

  return removed;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  const hasBearer = authHeader.toLowerCase().startsWith('bearer ');

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Missing required server env vars (SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).'
    });
  }

  if (!hasBearer) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  const token = authHeader.slice('bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const userRes = await supabaseAdmin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  const userId = userRes.data.user.id;

  const removedStorageObjects = await removeUserStorageObjects(supabaseAdmin, 'space-photos', userId);

  const deleteRes = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteRes.error) {
    console.error('[account-delete] delete user error', deleteRes.error);
    return res.status(500).json({ error: 'Unable to delete account right now.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Account deleted.',
    deletedUserId: userId,
    removedStorageObjects
  });
}
