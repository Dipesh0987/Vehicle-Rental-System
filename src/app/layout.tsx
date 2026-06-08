import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/components/Toast";
import TermsFloatingButton from "@/components/ui/TermsFloatingButton";
import WhatsAppFloat from "@/components/ui/WhatsAppFloat";

export const metadata: Metadata = {
  title: "ASSelf | #1 Self Drive Car Rental in Kathmandu Nepal | Vehicle Hire",
  description: "ASSelf - Nepal's best self-drive car rental service. Rent cars, SUVs, luxury vehicles in Kathmandu, Pokhara, Chitwan without driver. Affordable rates, well-maintained vehicles. Book now at Banasthali, Kathmandu!",
  keywords: "ASSelf, car rental Kathmandu, self drive car rental Nepal, vehicle rental Kathmandu, rent a car Nepal, self drive Kathmandu, car hire Nepal, SUV rental Kathmandu, luxury car rental Nepal, vehicle hire Kathmandu, Banasthali car rental, Pokhara car rental, Chitwan car rental, car rental without driver Nepal, monthly car rental Kathmandu, daily car rental Nepal, wedding car rental Kathmandu, airport pickup Nepal, tourist vehicle Nepal, cheap car rental Kathmandu, best car rental Nepal, self drive vehicles Nepal, rent car Kathmandu, vehicle on rent Nepal, car booking Kathmandu, self driving car Nepal, car rental near me Kathmandu, car rental service Nepal, rental cars Nepal, hire car Kathmandu, self drive rental Nepal, car rental company Kathmandu, vehicle rental service Nepal, car on hire Kathmandu, rent vehicle Nepal, car rental rates Kathmandu, affordable car rental Nepal, premium car rental Kathmandu, budget car rental Nepal, self drive SUV Kathmandu",
  authors: [{ name: "ASSelf - Self Drive Car Rental Nepal" }],
  creator: "ASSelf",
  publisher: "ASSelf Nepal",
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
    canonical: "https://asselfdrive.com",
    languages: {
      'en-US': 'https://asselfdrive.com',
      'ne-NP': 'https://asselfdrive.com/np',
    },
  },
  openGraph: {
    type: "website",
    url: "https://asselfdrive.com",
    title: "ASSelf | Best Self Drive Car Rental Kathmandu Nepal",
    description: "Nepal's #1 self-drive car rental. Rent cars, SUVs, luxury vehicles in Kathmandu without driver. Affordable rates. Book now!",
    siteName: "ASSelf - Self Drive Car Rental Nepal",
    locale: "en_US",
    images: [
      {
        url: "https://asselfdrive.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ASSelf - Self Drive Car Rental Kathmandu Nepal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@asselfdrive",
    creator: "@asselfdrive",
    title: "ASSelf | Self Drive Car Rental Kathmandu Nepal",
    description: "Nepal's best self-drive car rental. Rent cars, SUVs in Kathmandu, Pokhara. Drive yourself! Best prices.",
    images: ["https://asselfdrive.com/og-image.jpg"],
  },
  verification: {
    google: "your-google-verification-code",
  },
  category: "Car Rental",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚗</text></svg>",
    apple: "/apple-touch-icon.png",
  },
  other: {
    'geo.region': 'NP-BA',
    'geo.placename': 'Kathmandu',
    'geo.position': '27.7172;85.3240',
    'ICBM': '27.7172, 85.3240',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f7668",
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
