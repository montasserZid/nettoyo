import type { Language } from '../i18n/translations';

type CanonicalRoomKey =
  | 'bedroom'
  | 'living_room'
  | 'bathroom'
  | 'kitchen'
  | 'office'
  | 'basement'
  | 'walk_in_closet'
  | 'laundry_room';

type RoomLabels = Record<Language, Record<CanonicalRoomKey, { singular: string; plural: string }>>;

const ROOM_LABELS: RoomLabels = {
  fr: {
    bedroom: { singular: 'chambre', plural: 'chambres' },
    living_room: { singular: 'salon', plural: 'salons' },
    bathroom: { singular: 'salle de bain', plural: 'salles de bain' },
    kitchen: { singular: 'cuisine', plural: 'cuisines' },
    office: { singular: 'bureau', plural: 'bureaux' },
    basement: { singular: 'sous-sol', plural: 'sous-sols' },
    walk_in_closet: { singular: 'walk-in', plural: 'walk-ins' },
    laundry_room: { singular: 'buanderie', plural: 'buanderies' }
  },
  en: {
    bedroom: { singular: 'bedroom', plural: 'bedrooms' },
    living_room: { singular: 'living room', plural: 'living rooms' },
    bathroom: { singular: 'bathroom', plural: 'bathrooms' },
    kitchen: { singular: 'kitchen', plural: 'kitchens' },
    office: { singular: 'office', plural: 'offices' },
    basement: { singular: 'basement', plural: 'basements' },
    walk_in_closet: { singular: 'walk-in closet', plural: 'walk-in closets' },
    laundry_room: { singular: 'laundry room', plural: 'laundry rooms' }
  },
  es: {
    bedroom: { singular: 'habitacion', plural: 'habitaciones' },
    living_room: { singular: 'sala de estar', plural: 'salas de estar' },
    bathroom: { singular: 'bano', plural: 'banos' },
    kitchen: { singular: 'cocina', plural: 'cocinas' },
    office: { singular: 'oficina', plural: 'oficinas' },
    basement: { singular: 'sotano', plural: 'sotanos' },
    walk_in_closet: { singular: 'vestidor', plural: 'vestidores' },
    laundry_room: { singular: 'lavanderia', plural: 'lavanderias' }
  }
};

const ROOM_KEY_ALIASES: Record<string, CanonicalRoomKey> = {
  bedroom: 'bedroom',
  bedrooms: 'bedroom',
  living_room: 'living_room',
  living_rooms: 'living_room',
  livingroom: 'living_room',
  livingrooms: 'living_room',
  bathroom: 'bathroom',
  bathrooms: 'bathroom',
  kitchen: 'kitchen',
  kitchens: 'kitchen',
  office: 'office',
  offices: 'office',
  basement: 'basement',
  basements: 'basement',
  walk_in_closet: 'walk_in_closet',
  walk_in_closets: 'walk_in_closet',
  walkincloset: 'walk_in_closet',
  walkinclosets: 'walk_in_closet',
  laundry_room: 'laundry_room',
  laundry_rooms: 'laundry_room',
  laundryroom: 'laundry_room',
  laundryrooms: 'laundry_room'
};

type ParsedRoomToken = {
  key: string;
  tokenCount: number | null;
};

function parseRoomToken(rawToken: string): ParsedRoomToken {
  const normalized = rawToken.trim().toLowerCase();
  if (!normalized) {
    return { key: '', tokenCount: null };
  }

  const compact = normalized.replace(/[\s-]+/g, '_');
  const match = compact.match(/^(.*?)(\d+)$/);
  const rawKey = (match?.[1] ?? compact).replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  const tokenCount = match ? Number(match[2]) : null;
  const canonicalKey = ROOM_KEY_ALIASES[rawKey] ?? rawKey;

  return {
    key: canonicalKey,
    tokenCount: Number.isFinite(tokenCount) ? tokenCount : null
  };
}

function pickCount(rawValue: unknown, tokenCount: number | null) {
  const parsedRaw = typeof rawValue === 'number'
    ? rawValue
    : typeof rawValue === 'string'
      ? Number(rawValue)
      : rawValue === true
        ? 1
        : NaN;

  const hasRaw = Number.isFinite(parsedRaw) && parsedRaw > 0;
  const hasToken = Number.isFinite(tokenCount) && tokenCount !== null && tokenCount > 0;

  if (hasToken && (!hasRaw || parsedRaw <= 1)) {
    return tokenCount as number;
  }
  if (hasRaw) {
    return parsedRaw;
  }
  if (hasToken) {
    return tokenCount as number;
  }
  return null;
}

function prettifyUnknownRoomKey(key: string) {
  const text = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text || 'piece';
}

export type NormalizedRoomItem = {
  key: string;
  count: number;
};

export function normalizeRoomItems(value: unknown): NormalizedRoomItem[] {
  const collected: Record<string, number> = {};

  const pushItem = (rawToken: string, rawValue: unknown) => {
    const parsed = parseRoomToken(rawToken);
    if (!parsed.key) return;
    const count = pickCount(rawValue, parsed.tokenCount);
    if (count === null || !Number.isFinite(count) || count <= 0) return;
    collected[parsed.key] = (collected[parsed.key] ?? 0) + count;
  };

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === 'string') {
        pushItem(entry, 1);
        return;
      }
      if (entry && typeof entry === 'object') {
        const row = entry as { key?: unknown; count?: unknown; room?: unknown };
        const token = typeof row.key === 'string' ? row.key : typeof row.room === 'string' ? row.room : '';
        if (!token) return;
        pushItem(token, row.count ?? 1);
      }
    });
  } else if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
      pushItem(key, raw);
    });
  } else if (typeof value === 'string') {
    pushItem(value, 1);
  }

  return Object.entries(collected)
    .map(([key, count]) => ({ key, count }))
    .filter((item) => item.count > 0);
}

export function getLocalizedRoomText(roomKey: string, count: number, language: Language) {
  const labels = ROOM_LABELS[language][roomKey as CanonicalRoomKey];
  if (labels) {
    return `${count} ${count > 1 ? labels.plural : labels.singular}`;
  }
  const unknownLabel = prettifyUnknownRoomKey(roomKey);
  return `${count} ${unknownLabel}`;
}

