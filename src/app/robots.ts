import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/booking/', '/payment/', '/_next/', '/auth/'],
      },
    ],
    sitemap: 'https://asselfdrive.com/sitemap.xml',
  };
}
