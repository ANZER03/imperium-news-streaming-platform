import type {Metadata} from 'next';
import { Outfit, Playfair_Display } from 'next/font/google';
import './globals.css'; // Global styles

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: 'Imperium News',
  description: 'Fast, clean, engaging news reading experience',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${outfit.variable} ${playfair.variable}`}>
      <body className="bg-editorial-bg font-sans text-editorial-ink antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
