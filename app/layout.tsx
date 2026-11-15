import type { Metadata, Viewport } from 'next';
import './globals.css';
import PaperMotion from '@/components/PaperMotion';

export const metadata: Metadata = {
  title: 'Andrey Portfolio',
  description: 'Andrey Furlan de Souza, senior software engineer: front-end and mobile, from React Native apps to the web.',
};

// cover the notch area too; the page's gutters already add env(safe-area-inset-*)
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded as plain Google Fonts families (not next/font) because the 3D screens draw with these exact family
            names on canvas and wait for them with document.fonts.load. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@200..900&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      
      <body suppressHydrationWarning>
        {children}
        <PaperMotion />
      </body>
    </html>
  );
}
