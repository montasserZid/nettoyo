import { Helmet } from 'react-helmet-async';

export interface SEOHeadProps {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
  hreflang?: { locale: string; url: string }[];
  structuredData?: object;
}

const DEFAULT_OG_IMAGE = '/og-default.jpg';

export function SEOHead({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  noIndex = false,
  hreflang = [],
  structuredData
}: SEOHeadProps) {
  const robotsValue = noIndex ? 'noindex, nofollow' : 'index, follow';
  const resolvedOgImage = ogImage ?? DEFAULT_OG_IMAGE;
  const resolvedOgTitle = ogTitle ?? title;
  const resolvedOgDescription = ogDescription ?? description;

  return (
    <>
      <noscript>
        <title>{title}</title>
      </noscript>
      <Helmet prioritizeSeoTags>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content={robotsValue} />
        <meta name="googlebot" content={robotsValue} />
        <link rel="canonical" href={canonical} />

        <meta property="og:type" content="website" />
        <meta property="og:title" content={resolvedOgTitle} />
        <meta property="og:description" content={resolvedOgDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={resolvedOgImage} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={resolvedOgTitle} />
        <meta name="twitter:description" content={resolvedOgDescription} />
        <meta name="twitter:image" content={resolvedOgImage} />

        {hreflang.map((entry) => (
          <link key={entry.locale} rel="alternate" hrefLang={entry.locale} href={entry.url} />
        ))}
        {hreflang.length > 0 ? <link rel="alternate" hrefLang="x-default" href={hreflang[0].url} /> : null}

        {structuredData ? (
          <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        ) : null}
      </Helmet>
    </>
  );
}
