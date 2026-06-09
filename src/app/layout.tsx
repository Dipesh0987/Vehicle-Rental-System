import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/components/Toast";
import TermsFloatingButton from "@/components/ui/TermsFloatingButton";
import WhatsAppFloat from "@/components/ui/WhatsAppFloat";

export const metadata: Metadata = {
  metadataBase: new URL('https://asselfdrive.com'),
  title: {
    default: 'ASSelf Drive | Self Drive Car Rental Kathmandu Nepal',
    template: '%s | ASSelf Drive Kathmandu',
  },
  description: 'ASSelf Drive - Affordable self drive car rental in Banasthali Ring Road, Kathmandu, Nepal. Rent cars, SUVs & vehicles without driver. Book online now!',
  keywords: ['self drive car rental kathmandu', 'vehicle rental kathmandu', 'self drive vehicle rental nepal', 'car rental banasthali', 'rental vehicle kathmandu', 'self drive cars nepal', 'car hire kathmandu', 'rent car without driver nepal', 'ASSelf Drive'],
  authors: [{ name: 'ASSelf Drive', url: 'https://asselfdrive.com' }],
  creator: 'ASSelf Drive',
  publisher: 'ASSelf Drive',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://asselfdrive.com',
  },
  openGraph: {
    type: 'website',
    url: 'https://asselfdrive.com',
    title: 'ASSelf Drive | Self Drive Car Rental Kathmandu',
    description: 'Affordable self drive car rental in Banasthali, Kathmandu. Rent cars & SUVs without driver. Well-maintained vehicles at best rates.',
    siteName: 'ASSelf Drive',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ASSelf Drive - Self Drive Car Rental Kathmandu Nepal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ASSelf Drive | Self Drive Car Rental Kathmandu',
    description: 'Affordable self drive car & vehicle rental in Kathmandu, Nepal. Drive yourself at the best rates!',
    images: ['/og-image.jpg'],
  },
  verification: {
    google: 'YOUR_GOOGLE_VERIFICATION_CODE',
  },
  category: 'Car Rental',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  other: {
    'geo.region': 'NP-3',
    'geo.placename': 'Kathmandu, Banasthali',
    'geo.position': '27.6915;85.3420',
    'ICBM': '27.6915, 85.3420',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f7668',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Poppins:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,500,0,0"
        />
      </head>
      <body className="vrs-page min-h-screen font-poppins">
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "LocalBusiness",
                  "@id": "https://asselfdrive.com/#business",
                  "name": "ASSelf Drive",
                  "alternateName": "ASSelf Drive Car Rental",
                  "description": "Self drive car and vehicle rental service in Banasthali Ring Road, Kathmandu, Nepal. Affordable rates for cars, SUVs and vehicles without driver.",
                  "url": "https://asselfdrive.com",
                  "telephone": "+977-9704520781",
                  "email": "info@asselfdrive.com",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": "Banasthali Ring Road",
                    "addressLocality": "Kathmandu",
                    "addressRegion": "Bagmati",
                    "postalCode": "44600",
                    "addressCountry": "NP"
                  },
                  "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": "27.6915",
                    "longitude": "85.3420"
                  },
                  "openingHoursSpecification": [
                    {
                      "@type": "OpeningHoursSpecification",
                      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
                      "opens": "07:00",
                      "closes": "20:00"
                    }
                  ],
                  "priceRange": "NPR $$",
                  "image": "https://asselfdrive.com/og-image.jpg",
                  "sameAs": [],
                  "areaServed": {
                    "@type": "City",
                    "name": "Kathmandu"
                  },
                  "serviceType": "Self Drive Vehicle Rental"
                },
                {
                  "@type": "Organization",
                  "@id": "https://asselfdrive.com/#organization",
                  "name": "ASSelf Drive",
                  "url": "https://asselfdrive.com",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://asselfdrive.com/logo.png"
                  },
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "+977-9704520781",
                    "contactType": "customer service",
                    "areaServed": "NP",
                    "availableLanguage": ["English", "Nepali"]
                  }
                },
                {
                  "@type": "WebSite",
                  "@id": "https://asselfdrive.com/#website",
                  "url": "https://asselfdrive.com",
                  "name": "ASSelf Drive",
                  "publisher": { "@id": "https://asselfdrive.com/#organization" },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": "https://asselfdrive.com/vehicles?search={search_term_string}",
                    "query-input": "required name=search_term_string"
                  }
                }
              ]
            })
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
              <TermsFloatingButton />
              <WhatsAppFloat />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
