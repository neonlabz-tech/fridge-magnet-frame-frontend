import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Manrope } from 'next/font/google';
import Toast from '@/components/Toast';
import './globals.css';
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Magnify Admin Dashboard', template: '%s | Magnify Admin' },
  description:
    'Magnify Creations admin dashboard: orders, customers, products, inventory, deliveries, finance and sales leads in one place.',
  applicationName: 'Magnify Admin',
  // Private back-office: keep it out of search results.
  robots: { index: false, follow: false, nocache: true },
  openGraph: { title: 'Magnify Admin Dashboard', siteName: 'Magnify Creations', type: 'website' },
};

export const viewport: Viewport = {
  themeColor: '#0B3CB0',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full`}
      data-scroll-behavior="smooth"
    >
      {process.env.NODE_ENV === 'production' && <SpeedInsights />}
      <body className="min-h-full flex flex-col antialiased">
        <Toast />
        {children}
      </body>
    </html>
  );
}