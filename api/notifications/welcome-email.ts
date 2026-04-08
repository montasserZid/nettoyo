import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type Role = 'client' | 'nettoyeur';

type ProfileRow = {
  id: string;
  email: string | null;
  role: Role | null;
  first_name: string | null;
  welcome_email_sent_at: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveLogoUrl(req: any) {
  const forced = process.env.EMAIL_LOGO_URL?.trim();
  if (forced) return forced;
  const host = (req.headers?.['x-forwarded-host'] as string | undefined) || (req.headers?.host as string | undefined);
  const proto = (req.headers?.['x-forwarded-proto'] as string | undefined) || 'https';
  if (host) return `${proto}://${host}/Nettoyo_logo_with_sparkles_and_bubbles.png`;
  return 'https://via.placeholder.com/280x84.png?text=Nettoyo';
}

function buildWelcomeTemplate(input: { role: Role; firstName: string | null; logoUrl: string }) {
  const namePrefix = input.firstName?.trim() ? `${input.firstName.trim()}, ` : '';
  const isCleaner = input.role === 'nettoyeur';
  const subject = 'Bienvenue sur Nettoyó';
  const titleFr = isCleaner ? 'Bienvenue sur Nettoyó, partenaire nettoyeur' : 'Bienvenue sur Nettoyó';
  const introFr = isCleaner
    ? `${namePrefix}vous pouvez desormais recevoir des demandes de reservation et gerer vos disponibilites.`
    : `${namePrefix}vous pouvez desormais reserver des services de nettoyage pres de chez vous en toute simplicite.`;
  const introEn = isCleaner
    ? `${namePrefix}you can now receive booking requests and manage your availability.`
    : `${namePrefix}you can now book nearby cleaning services in a simple way.`;

  const text =
    `FR\n${titleFr}\n${introFr}\n\n` +
    `EN\nWelcome to Nettoyo\n${introEn}\n`;

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,0.12);">` +
    `<tr><td style="background:linear-gradient(120deg,#E0F2FE,#DCFCE7);padding:24px 24px 18px 24px;text-align:center;">` +
    `<img src="${escapeHtml(input.logoUrl)}" alt="Nettoyo" style="display:block;margin:0 auto;max-width:220px;width:100%;height:auto;" />` +
    `</td></tr>` +
    `<tr><td style="padding:26px 24px 18px 24px;">` +
    `<h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.2;color:#1A1A2E;">${escapeHtml(titleFr)}</h1>` +
    `<p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(introFr)}</p>` +
    `</td></tr>` +
    `<tr><td style="padding:0 24px;"><div style="height:1px;background:#E5E7EB;"></div></td></tr>` +
    `<tr><td style="padding:18px 24px 24px 24px;">` +
    `<h2 style="margin:0 0 10px 0;font-size:18px;line-height:1.3;color:#1A1A2E;">Welcome to Nettoyo</h2>` +
    `<p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(introEn)}</p>` +
    `</td></tr>` +
    `<tr><td style="padding:12px 24px 20px 24px;text-align:center;color:#6B7280;font-size:12px;">Nettoyo</td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = req.body ?? {};
  const userId = typeof payload.userId === 'string' ? payload.userId : null;

  if (!userId) {
    return res.status(400).json({ error: 'Invalid payload. Expected userId.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;

  if (!supabaseUrl || !supabaseServiceRoleKey || !gmailUser || !gmailPass) {
    return res.status(500).json({
      error: 'Missing required server env vars (SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASS).'
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });

  const claimedAt = new Date().toISOString();
  const claimRes = await supabase
    .from('profiles')
    .update({ welcome_email_sent_at: claimedAt })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('id,email,role,first_name,welcome_email_sent_at')
    .maybeSingle();

  if (claimRes.error) {
    return res.status(500).json({
      error: 'Unable to claim welcome email send.',
      details: claimRes.error.message
    });
  }

  const profile = (claimRes.data as ProfileRow | null) ?? null;
  if (!profile) {
    return res.status(200).json({ ok: true, skipped: 'already_sent_or_missing_profile' });
  }

  const role: Role = profile.role === 'nettoyeur' ? 'nettoyeur' : 'client';
  const recipient = profile.email?.trim() || '';
  if (!recipient) {
    await supabase
      .from('profiles')
      .update({ welcome_email_sent_at: null })
      .eq('id', userId)
      .eq('welcome_email_sent_at', claimedAt);
    return res.status(422).json({ error: 'Profile email missing.' });
  }

  const template = buildWelcomeTemplate({
    role,
    firstName: profile.first_name,
    logoUrl: resolveLogoUrl(req)
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: gmailUser,
      to: recipient,
      subject: template.subject,
      text: template.text,
      html: template.html
    });
  } catch (error: any) {
    await supabase
      .from('profiles')
      .update({ welcome_email_sent_at: null })
      .eq('id', userId)
      .eq('welcome_email_sent_at', claimedAt);
    return res.status(500).json({ error: 'Welcome email send failed.', details: error?.message ?? 'unknown' });
  }

  return res.status(200).json({ ok: true, userId, role, recipient });
}

