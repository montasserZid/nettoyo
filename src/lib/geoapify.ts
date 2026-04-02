export type HomeAddress = {
  formatted: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  country_code: string | null;
  street: string | null;
  street_number: string | null;
};

type GeoapifyAutocompleteResult = {
  formatted?: string;
  lat?: number;
  lon?: number;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  street?: string;
  housenumber?: string;
  address_line1?: string;
  address_line2?: string;
};

type GeoapifyAutocompleteResponse = {
  results?: GeoapifyAutocompleteResult[];
};

export type AddressSuggestion = {
  id: string;
  primary: string;
  secondary: string;
  address: HomeAddress;
};

const MONTREAL_BIAS = 'proximity:-73.5673,45.5017';

function mapResultToHomeAddress(result: GeoapifyAutocompleteResult): HomeAddress | null {
  if (typeof result.lat !== 'number' || typeof result.lon !== 'number') {
    return null;
  }

  const formatted = (result.formatted ?? '').trim();
  if (!formatted) {
    return null;
  }

  return {
    formatted,
    lat: result.lat,
    lng: result.lon,
    city: result.city ?? null,
    state: result.state ?? null,
    postal_code: result.postcode ?? null,
    country: result.country ?? null,
    country_code: result.country_code ? result.country_code.toUpperCase() : null,
    street: result.street ?? null,
    street_number: result.housenumber ?? null
  };
}

export async function fetchGeoapifyAddressSuggestions(
  query: string,
  apiKey: string,
  lang: 'fr' | 'en' | 'es',
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    text: trimmed,
    format: 'json',
    filter: 'countrycode:ca',
    bias: MONTREAL_BIAS,
    limit: '7',
    lang,
    apiKey
  });

  const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Geoapify request failed with status ${response.status}`);
  }

  const data = (await response.json()) as GeoapifyAutocompleteResponse;
  const seen = new Set<string>();

  return (data.results ?? [])
    .map((result) => {
      if ((result.country_code ?? '').toLowerCase() !== 'ca') {
        return null;
      }

      const mappedAddress = mapResultToHomeAddress(result);
      if (!mappedAddress) {
        return null;
      }

      const dedupeKey = `${mappedAddress.formatted}|${mappedAddress.lat}|${mappedAddress.lng}`;
      if (seen.has(dedupeKey)) {
        return null;
      }
      seen.add(dedupeKey);

      return {
        id: dedupeKey,
        primary: result.address_line1 ?? mappedAddress.formatted,
        secondary: result.address_line2 ?? [mappedAddress.city, mappedAddress.state, mappedAddress.country].filter(Boolean).join(', '),
        address: mappedAddress
      } satisfies AddressSuggestion;
    })
    .filter((item): item is AddressSuggestion => Boolean(item));
}

