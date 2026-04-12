import { parseBody, requireAdmin } from './_auth';

const createSettingsTableSql = `CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to admin settings" ON public.admin_settings;
CREATE POLICY "No direct client access to admin settings"
  ON public.admin_settings
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);`;

function defaultSettings() {
  return {
    platformFeeAmount: 5,
    sameDayLeadHours: 2,
    featureToggles: {
      bookingEnabled: true,
      cleanerSignupEnabled: true
    }
  };
}

export default async function handler(req: any, res: any) {
  try {
    const context = await requireAdmin(req, res);
    if (!context) return;
    const { supabaseAdmin } = context;

    const probe = await supabaseAdmin
      .from('admin_settings')
      .select('key,value_json,updated_at');

    if (probe.error) {
      if (probe.error.code === '42P01') {
        return res.status(200).json({
          supported: false,
          reason: 'admin_settings table not found.',
          createTableSql: createSettingsTableSql,
          settings: defaultSettings()
        });
      }
      return res.status(500).json({
        error: 'Unable to load admin settings.',
        details: probe.error.message
      });
    }

    if (req.method === 'GET') {
      const rows = (probe.data as Array<{ key: string; value_json: unknown }> | null) ?? [];
      const map = new Map(rows.map((row) => [row.key, row.value_json]));
      const defaults = defaultSettings();
      return res.status(200).json({
        supported: true,
        settings: {
          platformFeeAmount:
            typeof map.get('platform_fee_amount') === 'number'
              ? (map.get('platform_fee_amount') as number)
              : defaults.platformFeeAmount,
          sameDayLeadHours:
            typeof map.get('same_day_lead_hours') === 'number'
              ? (map.get('same_day_lead_hours') as number)
              : defaults.sameDayLeadHours,
          featureToggles:
            map.get('feature_toggles') && typeof map.get('feature_toggles') === 'object'
              ? (map.get('feature_toggles') as Record<string, unknown>)
              : defaults.featureToggles
        }
      });
    }

    if (req.method === 'PUT') {
      const body = parseBody(req);
      const platformFeeAmount = Number(body.platformFeeAmount);
      const sameDayLeadHours = Number(body.sameDayLeadHours);
      const featureToggles =
        body.featureToggles && typeof body.featureToggles === 'object'
          ? (body.featureToggles as Record<string, unknown>)
          : defaultSettings().featureToggles;

      if (!Number.isFinite(platformFeeAmount) || platformFeeAmount < 0) {
        return res.status(400).json({ error: 'platformFeeAmount must be a valid positive number.' });
      }
      if (!Number.isFinite(sameDayLeadHours) || sameDayLeadHours < 0) {
        return res.status(400).json({ error: 'sameDayLeadHours must be a valid positive number.' });
      }

      const rows = [
        { key: 'platform_fee_amount', value_json: platformFeeAmount, updated_at: new Date().toISOString() },
        { key: 'same_day_lead_hours', value_json: sameDayLeadHours, updated_at: new Date().toISOString() },
        { key: 'feature_toggles', value_json: featureToggles, updated_at: new Date().toISOString() }
      ];

      const saveRes = await supabaseAdmin
        .from('admin_settings')
        .upsert(rows, { onConflict: 'key' })
        .select('key,value_json,updated_at');

      if (saveRes.error) {
        return res.status(500).json({
          error: 'Unable to save admin settings.',
          details: saveRes.error.message
        });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: unknown) {
    console.error('[API ERROR][admin/settings]', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
