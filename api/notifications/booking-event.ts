import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type BookingRow = {
  id: string;
  status: string;
  scheduled_at: string | null;
  service_type: string | null;
  client_id: string;
  cleaner_id: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes('@')) return null;
  const [name, domain] = email.split('@');
  if (!name || !domain) return null;
  const prefix = name.slice(0, 2);
  return `${prefix}***@${domain}`;
}

function displayName(firstName: string | null, lastName: string | null, fallback: string) {
  const first = firstName?.trim() ?? '';
  const lastInitial = lastName?.trim()?.[0] ? `${lastName.trim()[0]}.` : '';
  const full = [first, lastInitial].filter(Boolean).join(' ').trim();
  return full || fallback;
}

export default async function handler(req: any, res: any) {
  console.log('[EMAIL] Route hit');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  const payload = req.body ?? {};
  console.log('[EMAIL] Body:', payload);
  const event = typeof payload.event === 'string' ? payload.event : null;
  const bookingId = typeof payload.bookingId === 'string' ? payload.bookingId : null;
  console.log('[booking-event] request received', {
    method: req.method,
    event,
    bookingId,
    hasBody: Boolean(req.body)
  });

  if (event !== 'booking_created' || !bookingId) {
    console.error('[booking-event] invalid payload', payload);
    return res.status(400).json({ error: 'Invalid payload. Expected event=booking_created and bookingId.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;
  const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  const hasBearer = authHeader.toLowerCase().startsWith('bearer ');

  console.log('[booking-event] env presence', {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
    hasAnonKey: Boolean(supabaseAnonKey),
    hasBearerAuth: hasBearer,
    hasGmailUser: Boolean(gmailUser),
    hasGmailPass: Boolean(gmailPass)
  });

  if (!supabaseUrl || (!supabaseServiceRoleKey && !supabaseAnonKey) || !gmailUser || !gmailPass) {
    console.error('[booking-event] missing required server env vars');
    return res.status(500).json({
      error: 'Missing required server env vars (SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY, GMAIL_USER, GMAIL_APP_PASS).'
    });
  }

  if (!supabaseServiceRoleKey && !hasBearer) {
    console.error('[booking-event] missing bearer token while running with anon key');
    return res.status(401).json({ error: 'Missing bearer token for anon-key mode.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || (supabaseAnonKey as string), {
    auth: { persistSession: false },
    global: hasBearer ? { headers: { Authorization: authHeader } } : undefined
  });

  const bookingRes = await supabase
    .from('bookings')
    .select('id,status,scheduled_at,service_type,client_id,cleaner_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingRes.error) {
    console.error('[booking-event] booking query failed', bookingRes.error);
    return res.status(500).json({ error: 'Unable to fetch booking.', details: bookingRes.error.message });
  }

  const booking = bookingRes.data as BookingRow | null;
  if (!booking) {
    console.error('[booking-event] booking not found', { bookingId });
    return res.status(404).json({ error: 'Booking not found.' });
  }
  console.log('[EMAIL] Booking:', booking);

  console.log('[booking-event] booking loaded', {
    id: booking.id,
    status: booking.status,
    clientId: booking.client_id,
    cleanerId: booking.cleaner_id,
    scheduledAt: booking.scheduled_at
  });

  if (!booking.cleaner_id) {
    console.error('[booking-event] cleaner_id missing on booking', { bookingId });
    return res.status(422).json({ error: 'Booking is missing cleaner_id.' });
  }

  const profileRes = await supabase
    .from('profiles')
    .select('id,email,first_name,last_name')
    .in('id', [booking.client_id, booking.cleaner_id]);

  if (profileRes.error) {
    console.error('[booking-event] profile query failed', profileRes.error);
    return res.status(500).json({ error: 'Unable to fetch profiles.', details: profileRes.error.message });
  }

  const profiles = (profileRes.data as ProfileRow[] | null) ?? [];
  const byId = new Map(profiles.map((row) => [row.id, row]));
  const cleanerProfile = byId.get(booking.cleaner_id);
  const clientProfile = byId.get(booking.client_id);
  const cleanerEmail = cleanerProfile?.email?.trim() || null;
  const clientEmail = clientProfile?.email?.trim() || null;
  console.log('[EMAIL] Cleaner email:', cleanerEmail);
  console.log('[EMAIL] Client email:', clientEmail);

  console.log('[booking-event] recipients resolved', {
    cleanerEmailMasked: maskEmail(cleanerEmail),
    clientEmailMasked: maskEmail(clientEmail),
    profilesFound: profiles.length
  });

  if (!cleanerEmail || !clientEmail) {
    console.error('[booking-event] recipient email missing', {
      hasCleanerEmail: Boolean(cleanerEmail),
      hasClientEmail: Boolean(clientEmail)
    });
    return res.status(422).json({ error: 'Missing cleaner or client email in profiles.' });
  }

  const cleanerName = displayName(cleanerProfile?.first_name ?? null, cleanerProfile?.last_name ?? null, 'Cleaner');
  const clientName = displayName(clientProfile?.first_name ?? null, clientProfile?.last_name ?? null, 'Client');
  const scheduledLabel = booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleString('fr-CA', { timeZone: 'America/Toronto' }) : 'Date a confirmer';
  const serviceLabel = booking.service_type || 'Service de nettoyage';
  const bookingRef = `BK-${booking.id.replace(/-/g, '').toUpperCase().slice(0, 6)}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });

  try {
    console.log('[EMAIL] Using:', process.env.GMAIL_USER);
    console.log('[EMAIL] PASS LENGTH:', process.env.GMAIL_APP_PASS?.length);
    console.log('[booking-event] transporter verify start');
    await transporter.verify();
    console.log('[EMAIL] SMTP ready');
    console.log('[booking-event] transporter verify success');
  } catch (verifyError: any) {
    console.error('[booking-event] transporter verify failed', {
      message: verifyError?.message,
      code: verifyError?.code
    });
    return res.status(500).json({ error: 'SMTP verification failed.', details: verifyError?.message ?? 'unknown' });
  }

  try {
    console.log('[booking-event] send cleaner email start');
    const cleanerSend = await transporter.sendMail({
      from: gmailUser,
      to: cleanerEmail,
      subject: `Nouvelle demande de reservation (${bookingRef})`,
      text:
        `Bonjour ${cleanerName},\n\n` +
        `Vous avez recu une nouvelle demande de reservation.\n` +
        `Reference: ${bookingRef}\n` +
        `Client: ${clientName}\n` +
        `Service: ${serviceLabel}\n` +
        `Date: ${scheduledLabel}\n` +
        `Statut: En attente\n`,
      html:
        `<p>Bonjour ${cleanerName},</p>` +
        `<p>Vous avez recu une nouvelle demande de reservation.</p>` +
        `<ul><li><strong>Reference:</strong> ${bookingRef}</li><li><strong>Client:</strong> ${clientName}</li><li><strong>Service:</strong> ${serviceLabel}</li><li><strong>Date:</strong> ${scheduledLabel}</li><li><strong>Statut:</strong> En attente</li></ul>`
    });
    console.log('[EMAIL] SENT:', cleanerSend);
    console.log('[booking-event] send cleaner email success', { messageId: cleanerSend.messageId });

    console.log('[booking-event] send client email start');
    const clientSend = await transporter.sendMail({
      from: gmailUser,
      to: clientEmail,
      subject: `Reservation envoyee (${bookingRef})`,
      text:
        `Bonjour ${clientName},\n\n` +
        `Votre reservation a ete envoyee avec succes.\n` +
        `Reference: ${bookingRef}\n` +
        `Service: ${serviceLabel}\n` +
        `Date: ${scheduledLabel}\n` +
        `Statut actuel: En attente\n\n` +
        `Vous recevrez un email une fois la demande confirmee.`,
      html:
        `<p>Bonjour ${clientName},</p>` +
        `<p>Votre reservation a ete envoyee avec succes.</p>` +
        `<ul><li><strong>Reference:</strong> ${bookingRef}</li><li><strong>Service:</strong> ${serviceLabel}</li><li><strong>Date:</strong> ${scheduledLabel}</li><li><strong>Statut actuel:</strong> En attente</li></ul>` +
        `<p>Vous recevrez un email une fois la demande confirmee.</p>`
    });
    console.log('[EMAIL] SENT:', clientSend);
    console.log('[booking-event] send client email success', { messageId: clientSend.messageId });
  } catch (sendError: any) {
    console.error('[EMAIL] ERROR:', sendError);
    console.error('[booking-event] sendMail failed', {
      message: sendError?.message,
      code: sendError?.code,
      response: sendError?.response
    });
    return res.status(500).json({ error: 'Email send failed.', details: sendError?.message ?? 'unknown' });
  }

  const elapsedMs = Date.now() - startedAt;
  console.log('[booking-event] completed', { bookingId, event, elapsedMs });
  return res.status(200).json({ ok: true, bookingId, event, elapsedMs });
}
