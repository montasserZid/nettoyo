import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

type BookingRow = {
  id: string;
  status: string;
  scheduled_at: string | null;
  service_type: string | null;
  client_id: string;
  cleaner_id: string | null;
  spaces?: BookingSpace | BookingSpace[] | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type BookingSpace = {
  city?: string | null;
  postal_code?: string | null;
  type?: string | null;
} | null;

type EmailTemplateInput = {
  logoUrl: string;
  bookingRef: string;
  statusLabelFr: string;
  statusLabelEn: string;
  city: string;
  postalCode: string;
  propertyTypeFr: string;
  propertyTypeEn: string;
  reservationDateFr: string;
  reservationDateEn: string;
  reservationTimeFr: string;
  reservationTimeEn: string;
  serviceLabel: string;
  cleanerMaskedName: string;
  clientMaskedName: string;
};

type EmailTemplateOutput = {
  subject: string;
  text: string;
  html: string;
};

type NotificationEvent = 'booking_created' | 'booking_confirmed';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPrimarySpace(space: BookingRow['spaces']): BookingSpace {
  if (Array.isArray(space)) return (space[0] ?? null) as BookingSpace;
  return (space ?? null) as BookingSpace;
}

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes('@')) return null;
  const [name, domain] = email.split('@');
  if (!name || !domain) return null;
  const prefix = name.slice(0, 2);
  return `${prefix}***@${domain}`;
}

function toMaskedDisplayName(firstName: string | null, lastName: string | null, fallback: string) {
  const first = firstName?.trim() ?? '';
  if (!first) return fallback;
  const cleanFirst = `${first[0].toUpperCase()}${first.slice(1).toLowerCase()}`;
  const lastInitial = lastName?.trim()?.[0]?.toUpperCase() ?? '';
  return lastInitial ? `${cleanFirst}.${lastInitial}` : cleanFirst;
}

function serviceLabelFromRaw(value: string | null) {
  if (!value?.trim()) return 'Service de nettoyage / Cleaning service';
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

function propertyTypePair(value: string | null | undefined) {
  const type = (value ?? '').toLowerCase();
  if (type === 'apartment') return { fr: 'Appartement', en: 'Apartment' };
  if (type === 'house') return { fr: 'Maison', en: 'House' };
  if (type === 'office') return { fr: 'Bureau', en: 'Office' };
  return { fr: 'Autre', en: 'Other' };
}

function formatReservationDateTime(value: string | null) {
  if (!value) {
    return {
      dateFr: 'A confirmer',
      dateEn: 'To be confirmed',
      timeFr: '--:--',
      timeEn: '--:--'
    };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      dateFr: 'A confirmer',
      dateEn: 'To be confirmed',
      timeFr: '--:--',
      timeEn: '--:--'
    };
  }
  const dateFr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto', dateStyle: 'long' }).format(parsed);
  const dateEn = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', dateStyle: 'long' }).format(parsed);
  const timeFr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit' }).format(parsed);
  const timeEn = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit' }).format(parsed);
  return { dateFr, dateEn, timeFr, timeEn };
}

function resolveLogoUrl(req: any) {
  const forced = process.env.EMAIL_LOGO_URL?.trim();
  if (forced) return forced;
  const host = (req.headers?.['x-forwarded-host'] as string | undefined) || (req.headers?.host as string | undefined);
  const proto = (req.headers?.['x-forwarded-proto'] as string | undefined) || 'https';
  if (host) return `${proto}://${host}/Nettoyo_logo_with_sparkles_and_bubbles.png`;
  return 'https://via.placeholder.com/280x84.png?text=Nettoyo';
}

function summaryRowsFr(input: EmailTemplateInput) {
  return [
    ['Reference', input.bookingRef],
    ['Ville', input.city],
    ['Code postal', input.postalCode],
    ['Type de propriete', input.propertyTypeFr],
    ['Service', input.serviceLabel],
    ['Date', input.reservationDateFr],
    ['Heure', input.reservationTimeFr]
  ] as Array<[string, string]>;
}

function summaryRowsEn(input: EmailTemplateInput) {
  return [
    ['Reference', input.bookingRef],
    ['City', input.city],
    ['Postal code', input.postalCode],
    ['Property type', input.propertyTypeEn],
    ['Service', input.serviceLabel],
    ['Date', input.reservationDateEn],
    ['Time', input.reservationTimeEn]
  ] as Array<[string, string]>;
}

function rowsToHtml(rows: Array<[string, string]>) {
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:#6B7280;font-size:13px;">${escapeHtml(label)}</td><td style="padding:8px 0;color:#111827;font-size:13px;font-weight:700;text-align:right;">${escapeHtml(value)}</td></tr>`
    )
    .join('');
}

function buildShell(params: {
  logoUrl: string;
  titleFr: string;
  titleEn: string;
  introFr: string;
  introEn: string;
  badgeFr?: string;
  badgeEn?: string;
  frRowsHtml: string;
  enRowsHtml: string;
}) {
  const badgeBlock = params.badgeFr
    ? `<div style="margin-top:10px;display:inline-block;padding:7px 12px;border-radius:999px;background:#E0F2FE;color:#0284C7;font-size:12px;font-weight:700;">${escapeHtml(
        params.badgeFr
      )}</div>`
    : '';

  const badgeEnBlock = params.badgeEn
    ? `<div style="margin-top:10px;display:inline-block;padding:7px 12px;border-radius:999px;background:#E0F2FE;color:#0284C7;font-size:12px;font-weight:700;">${escapeHtml(
        params.badgeEn
      )}</div>`
    : '';

  return (
    `<!doctype html><html><body style="margin:0;padding:24px;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,0.12);">` +
    `<tr><td style="background:linear-gradient(120deg,#E0F2FE,#DCFCE7);padding:24px 24px 18px 24px;text-align:center;">` +
    `<img src="${escapeHtml(params.logoUrl)}" alt="Nettoyo" style="display:block;margin:0 auto;max-width:220px;width:100%;height:auto;" />` +
    `</td></tr>` +
    `<tr><td style="padding:26px 24px 14px 24px;">` +
    `<h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.2;color:#1A1A2E;">${escapeHtml(params.titleFr)}</h1>` +
    `<p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(params.introFr)}</p>` +
    `${badgeBlock}` +
    `<div style="margin-top:16px;border:1px solid #E5E7EB;border-radius:14px;padding:14px 16px;background:#FAFAFA;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${params.frRowsHtml}</table></div>` +
    `</td></tr>` +
    `<tr><td style="padding:0 24px;"><div style="height:1px;background:#E5E7EB;"></div></td></tr>` +
    `<tr><td style="padding:18px 24px 26px 24px;">` +
    `<h2 style="margin:0 0 10px 0;font-size:18px;line-height:1.3;color:#1A1A2E;">${escapeHtml(params.titleEn)}</h2>` +
    `<p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(params.introEn)}</p>` +
    `${badgeEnBlock}` +
    `<div style="margin-top:16px;border:1px solid #E5E7EB;border-radius:14px;padding:14px 16px;background:#FAFAFA;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${params.enRowsHtml}</table></div>` +
    `</td></tr>` +
    `<tr><td style="padding:12px 24px 20px 24px;text-align:center;color:#6B7280;font-size:12px;">Nettoyo</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

function buildCleanerRequestEmail(input: EmailTemplateInput): EmailTemplateOutput {
  const subject = `Nouvelle demande recue (${input.bookingRef})`;
  const text =
    `FR\n` +
    `Bonjour ${input.cleanerMaskedName},\n` +
    `Une nouvelle demande de reservation a ete recue.\n` +
    `Reference: ${input.bookingRef}\n` +
    `Ville: ${input.city}\n` +
    `Code postal: ${input.postalCode}\n` +
    `Type de propriete: ${input.propertyTypeFr}\n` +
    `Date: ${input.reservationDateFr}\n` +
    `Heure: ${input.reservationTimeFr}\n\n` +
    `EN\n` +
    `Hello ${input.cleanerMaskedName},\n` +
    `A new booking request has been received.\n` +
    `Reference: ${input.bookingRef}\n` +
    `City: ${input.city}\n` +
    `Postal code: ${input.postalCode}\n` +
    `Property type: ${input.propertyTypeEn}\n` +
    `Date: ${input.reservationDateEn}\n` +
    `Time: ${input.reservationTimeEn}\n`;

  const html = buildShell({
    logoUrl: input.logoUrl,
    titleFr: 'Nouvelle demande de reservation',
    titleEn: 'New booking request',
    introFr: 'Une nouvelle demande vient d arriver sur votre compte Nettoyo.',
    introEn: 'A new booking request has arrived in your Nettoyo account.',
    frRowsHtml: rowsToHtml(summaryRowsFr(input)),
    enRowsHtml: rowsToHtml(summaryRowsEn(input))
  });

  return { subject, text, html };
}

function buildClientPendingEmail(input: EmailTemplateInput): EmailTemplateOutput {
  const subject = `Reservation envoyee (${input.bookingRef})`;
  const text =
    `FR\n` +
    `Bonjour,\n` +
    `Votre reservation a ete envoyee avec succes.\n` +
    `Statut: ${input.statusLabelFr}\n` +
    `Nettoyeur: ${input.cleanerMaskedName}\n` +
    `Reference: ${input.bookingRef}\n` +
    `Ville: ${input.city}\n` +
    `Code postal: ${input.postalCode}\n` +
    `Type de propriete: ${input.propertyTypeFr}\n` +
    `Date: ${input.reservationDateFr}\n` +
    `Heure: ${input.reservationTimeFr}\n\n` +
    `EN\n` +
    `Hello,\n` +
    `Your booking request was sent successfully.\n` +
    `Status: ${input.statusLabelEn}\n` +
    `Cleaner: ${input.cleanerMaskedName}\n` +
    `Reference: ${input.bookingRef}\n` +
    `City: ${input.city}\n` +
    `Postal code: ${input.postalCode}\n` +
    `Property type: ${input.propertyTypeEn}\n` +
    `Date: ${input.reservationDateEn}\n` +
    `Time: ${input.reservationTimeEn}\n`;

  const frRows = [...summaryRowsFr(input), ['Nettoyeur', input.cleanerMaskedName], ['Statut', input.statusLabelFr]] as Array<[string, string]>;
  const enRows = [...summaryRowsEn(input), ['Cleaner', input.cleanerMaskedName], ['Status', input.statusLabelEn]] as Array<[string, string]>;
  const html = buildShell({
    logoUrl: input.logoUrl,
    titleFr: 'Reservation envoyee',
    titleEn: 'Booking request sent',
    introFr: 'Votre demande a bien ete envoyee. Elle est en attente de confirmation par le nettoyeur.',
    introEn: 'Your request was sent successfully. It is pending cleaner confirmation.',
    badgeFr: input.statusLabelFr,
    badgeEn: input.statusLabelEn,
    frRowsHtml: rowsToHtml(frRows),
    enRowsHtml: rowsToHtml(enRows)
  });

  return { subject, text, html };
}

function buildCleanerConfirmedEmail(input: EmailTemplateInput): EmailTemplateOutput {
  const subject = `Reservation confirmee (${input.bookingRef})`;
  const text =
    `FR\n` +
    `Bonjour ${input.cleanerMaskedName},\n` +
    `Votre acceptation est enregistree.\n` +
    `La reservation est maintenant confirmee.\n` +
    `Reference: ${input.bookingRef}\n` +
    `Client: ${input.clientMaskedName}\n` +
    `Ville: ${input.city}\n` +
    `Code postal: ${input.postalCode}\n` +
    `Type de propriete: ${input.propertyTypeFr}\n` +
    `Date: ${input.reservationDateFr}\n` +
    `Heure: ${input.reservationTimeFr}\n\n` +
    `EN\n` +
    `Hello ${input.cleanerMaskedName},\n` +
    `Your acceptance has been recorded.\n` +
    `The booking is now confirmed.\n` +
    `Reference: ${input.bookingRef}\n` +
    `Client: ${input.clientMaskedName}\n` +
    `City: ${input.city}\n` +
    `Postal code: ${input.postalCode}\n` +
    `Property type: ${input.propertyTypeEn}\n` +
    `Date: ${input.reservationDateEn}\n` +
    `Time: ${input.reservationTimeEn}\n`;

  const frRows = [...summaryRowsFr(input), ['Client', input.clientMaskedName], ['Statut', input.statusLabelFr]] as Array<[string, string]>;
  const enRows = [...summaryRowsEn(input), ['Client', input.clientMaskedName], ['Status', input.statusLabelEn]] as Array<[string, string]>;
  const html = buildShell({
    logoUrl: input.logoUrl,
    titleFr: 'Reservation confirmee',
    titleEn: 'Booking confirmed',
    introFr: 'Votre acceptation est bien enregistree.',
    introEn: 'Your acceptance has been successfully recorded.',
    badgeFr: input.statusLabelFr,
    badgeEn: input.statusLabelEn,
    frRowsHtml: rowsToHtml(frRows),
    enRowsHtml: rowsToHtml(enRows)
  });

  return { subject, text, html };
}

function buildClientConfirmedEmail(input: EmailTemplateInput): EmailTemplateOutput {
  const subject = `Reservation confirmee (${input.bookingRef})`;
  const text =
    `FR\n` +
    `Bonjour,\n` +
    `Bonne nouvelle: votre reservation est maintenant confirmee.\n` +
    `Nettoyeur: ${input.cleanerMaskedName}\n` +
    `Reference: ${input.bookingRef}\n` +
    `Statut: ${input.statusLabelFr}\n` +
    `Ville: ${input.city}\n` +
    `Code postal: ${input.postalCode}\n` +
    `Type de propriete: ${input.propertyTypeFr}\n` +
    `Date: ${input.reservationDateFr}\n` +
    `Heure: ${input.reservationTimeFr}\n\n` +
    `EN\n` +
    `Hello,\n` +
    `Good news: your booking is now confirmed.\n` +
    `Cleaner: ${input.cleanerMaskedName}\n` +
    `Reference: ${input.bookingRef}\n` +
    `Status: ${input.statusLabelEn}\n` +
    `City: ${input.city}\n` +
    `Postal code: ${input.postalCode}\n` +
    `Property type: ${input.propertyTypeEn}\n` +
    `Date: ${input.reservationDateEn}\n` +
    `Time: ${input.reservationTimeEn}\n`;

  const frRows = [...summaryRowsFr(input), ['Nettoyeur', input.cleanerMaskedName], ['Statut', input.statusLabelFr]] as Array<[string, string]>;
  const enRows = [...summaryRowsEn(input), ['Cleaner', input.cleanerMaskedName], ['Status', input.statusLabelEn]] as Array<[string, string]>;
  const html = buildShell({
    logoUrl: input.logoUrl,
    titleFr: 'Reservation confirmee',
    titleEn: 'Booking confirmed',
    introFr: 'Votre demande a ete acceptee par le nettoyeur.',
    introEn: 'Your request has been accepted by the cleaner.',
    badgeFr: input.statusLabelFr,
    badgeEn: input.statusLabelEn,
    frRowsHtml: rowsToHtml(frRows),
    enRowsHtml: rowsToHtml(enRows)
  });

  return { subject, text, html };
}

export default async function handler(req: any, res: any) {
  console.log('[EMAIL] Route hit');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  const payload = req.body ?? {};
  console.log('[EMAIL] Body:', payload);
  const event =
    payload.event === 'booking_created' || payload.event === 'booking_confirmed'
      ? (payload.event as NotificationEvent)
      : null;
  const bookingId = typeof payload.bookingId === 'string' ? payload.bookingId : null;
  console.log('[booking-event] request received', {
    method: req.method,
    event,
    bookingId,
    hasBody: Boolean(req.body)
  });

  if (!event || !bookingId) {
    console.error('[booking-event] invalid payload', payload);
    return res.status(400).json({ error: 'Invalid payload. Expected event=booking_created|booking_confirmed and bookingId.' });
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
    .select('id,status,scheduled_at,service_type,client_id,cleaner_id,spaces(city,postal_code,type)')
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

  if (event === 'booking_confirmed' && booking.status !== 'confirmed') {
    console.error('[booking-event] booking_confirmed event rejected because booking status is not confirmed', {
      bookingId,
      status: booking.status
    });
    return res.status(409).json({ error: 'Booking status is not confirmed.', status: booking.status });
  }

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

  const cleanerMaskedName = toMaskedDisplayName(cleanerProfile?.first_name ?? null, cleanerProfile?.last_name ?? null, 'Cleaner');
  const clientMaskedName = toMaskedDisplayName(clientProfile?.first_name ?? null, clientProfile?.last_name ?? null, 'Client');
  const serviceLabel = serviceLabelFromRaw(booking.service_type);
  const space = getPrimarySpace(booking.spaces);
  const propertyType = propertyTypePair(space?.type);
  const schedule = formatReservationDateTime(booking.scheduled_at);
  const city = space?.city?.trim() || '--';
  const postalCode = space?.postal_code?.trim() || '--';
  const bookingRef = `BK-${booking.id.replace(/-/g, '').toUpperCase().slice(0, 6)}`;
  const logoUrl = resolveLogoUrl(req);
  const isConfirmedEvent = event === 'booking_confirmed';
  const templateInput: EmailTemplateInput = {
    logoUrl,
    bookingRef,
    statusLabelFr: isConfirmedEvent ? 'Confirmee' : 'En attente',
    statusLabelEn: isConfirmedEvent ? 'Confirmed' : 'Pending',
    city,
    postalCode,
    propertyTypeFr: propertyType.fr,
    propertyTypeEn: propertyType.en,
    reservationDateFr: schedule.dateFr,
    reservationDateEn: schedule.dateEn,
    reservationTimeFr: schedule.timeFr,
    reservationTimeEn: schedule.timeEn,
    serviceLabel,
    cleanerMaskedName,
    clientMaskedName
  };
  const cleanerEmailTemplate = isConfirmedEvent
    ? buildCleanerConfirmedEmail(templateInput)
    : buildCleanerRequestEmail(templateInput);
  const clientEmailTemplate = isConfirmedEvent
    ? buildClientConfirmedEmail(templateInput)
    : buildClientPendingEmail(templateInput);

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
      subject: cleanerEmailTemplate.subject,
      text: cleanerEmailTemplate.text,
      html: cleanerEmailTemplate.html
    });
    console.log('[EMAIL] SENT:', cleanerSend);
    console.log('[booking-event] send cleaner email success', { messageId: cleanerSend.messageId });

    console.log('[booking-event] send client email start');
    const clientSend = await transporter.sendMail({
      from: gmailUser,
      to: clientEmail,
      subject: clientEmailTemplate.subject,
      text: clientEmailTemplate.text,
      html: clientEmailTemplate.html
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
