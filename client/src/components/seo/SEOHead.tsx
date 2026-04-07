import { useEffect } from 'react';

export interface SEOProps {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  structuredData?: Record<string, any>;
  alternateLanguages?: { lang: string; url: string }[];
}

const BASE_URL = 'https://e-code.ai';
const DEFAULT_OG_IMAGE = `${BASE_URL}/assets/og-default.png`;
const SITE_NAME = 'E-Code';
const TWITTER_HANDLE = '@ecode_dev';

/**
 * SEOHead component for managing all SEO meta tags
 * Uses document.head manipulation for SPA compatibility
 */
export function SEOHead({
  title,
  description,
  keywords = [],
  canonicalUrl,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  author,
  publishedTime,
  modifiedTime,
  noIndex = false,
  noFollow = false,
  structuredData,
  alternateLanguages = [],
}: SEOProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const fullCanonicalUrl = canonicalUrl || (typeof window !== 'undefined' ? window.location.href.split('?')[0] : BASE_URL);
  const fullOgImage = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper to set or create meta tag
    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Helper to set or create link tag
    const setLink = (rel: string, href: string, hreflang?: string) => {
      const selector = hreflang
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]:not([hreflang])`;
      let link = document.querySelector(selector) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        if (hreflang) link.hreflang = hreflang;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // Basic meta tags
    setMeta('description', description);
    if (keywords.length > 0) {
      setMeta('keywords', keywords.join(', '));
    }

    // Robots
    const robotsContent = [
      noIndex ? 'noindex' : 'index',
      noFollow ? 'nofollow' : 'follow',
      'max-image-preview:large',
      'max-snippet:-1',
      'max-video-preview:-1'
    ].join(', ');
    setMeta('robots', robotsContent);
    setMeta('googlebot', robotsContent);

    // Author
    if (author) {
      setMeta('author', author);
    }

    // Open Graph
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', description, true);
    setMeta('og:type', ogType, true);
    setMeta('og:url', fullCanonicalUrl, true);
    setMeta('og:image', fullOgImage, true);
    setMeta('og:image:width', '1200', true);
    setMeta('og:image:height', '630', true);
    setMeta('og:image:alt', title, true);
    setMeta('og:site_name', SITE_NAME, true);
    setMeta('og:locale', 'en_US', true);

    // Twitter Card
    setMeta('twitter:card', twitterCard);
    setMeta('twitter:site', TWITTER_HANDLE);
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    setMeta('twitter:image', fullOgImage);
    setMeta('twitter:image:alt', title);

    // Article specific
    if (ogType === 'article') {
      if (publishedTime) setMeta('article:published_time', publishedTime, true);
      if (modifiedTime) setMeta('article:modified_time', modifiedTime, true);
      if (author) setMeta('article:author', author, true);
    }

    // Canonical URL
    setLink('canonical', fullCanonicalUrl);

    // Alternate languages
    alternateLanguages.forEach(({ lang, url }) => {
      setLink('alternate', url, lang);
    });

    // Structured data (JSON-LD) - unique per page with cleanup
    const scriptId = `ld-json-${fullCanonicalUrl.replace(/[^a-zA-Z0-9]/g, '-')}`;
    if (structuredData) {
      // Remove any existing JSON-LD scripts to avoid duplicates
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => s.remove());
      
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = scriptId;
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    // Cleanup function - remove page-specific JSON-LD on unmount
    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [
    fullTitle,
    description,
    keywords,
    fullCanonicalUrl,
    fullOgImage,
    ogType,
    twitterCard,
    author,
    publishedTime,
    modifiedTime,
    noIndex,
    noFollow,
    structuredData,
    alternateLanguages
  ]);

  return null;
}

// Pre-built structured data generators with @id for graph linking
export const structuredData = {
  organization: () => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'E-Code',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      '@id': `${BASE_URL}/#logo`,
      url: `${BASE_URL}/assets/logo.svg`,
      width: 512,
      height: 512
    },
    image: `${BASE_URL}/assets/og-default.png`,
    description: 'AI-powered enterprise development platform for Fortune 500 companies',
    foundingDate: '2024',
    sameAs: [
      'https://twitter.com/ecode_dev',
      'https://github.com/e-code',
      'https://linkedin.com/company/e-code'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-800-ECODE',
      contactType: 'sales',
      availableLanguage: ['English', 'French', 'German', 'Spanish', 'Italian']
    }
  }),

  website: () => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    name: 'E-Code',
    url: BASE_URL,
    publisher: { '@id': `${BASE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    },
    inLanguage: ['en', 'fr', 'de', 'es', 'it']
  }),

  softwareApplication: (name: string, description: string, category: string) => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${BASE_URL}/#software`,
    name,
    description,
    url: BASE_URL,
    image: `${BASE_URL}/assets/og-default.png`,
    applicationCategory: category,
    operatingSystem: 'Web, Windows, macOS, Linux',
    author: { '@id': `${BASE_URL}/#organization` },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '15000',
      bestRating: '5',
      worstRating: '1'
    }
  }),

  faqPage: (faqs: { question: string; answer: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  }),

  breadcrumb: (items: { name: string; url: string }[]) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }),

  article: (title: string, description: string, author: string, publishDate: string, imageUrl: string) => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: {
      '@type': 'Person',
      name: author
    },
    publisher: {
      '@type': 'Organization',
      name: 'E-Code',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/assets/logo.svg`
      }
    },
    datePublished: publishDate,
    image: imageUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': BASE_URL
    }
  }),

  product: (name: string, description: string, price: string, currency = 'USD') => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: {
      '@type': 'Brand',
      name: 'E-Code'
    },
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock'
    }
  }),

  localBusiness: () => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareCompany',
    name: 'E-Code',
    image: `${BASE_URL}/assets/logo.svg`,
    url: BASE_URL,
    telephone: '+1-800-ECODE',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '100 Innovation Drive',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      postalCode: '94105',
      addressCountry: 'US'
    },
    priceRange: '$$$',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '18:00'
    }
  })
};

export default SEOHead;
