import type { Metadata } from 'next';
import { DM_Mono, Libre_Baskerville } from 'next/font/google';
import './globals.css';

const serif = Libre_Baskerville({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const mono = DM_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Demo Day Founder Video and Follow-Up Content | VideoClaw',
  description:
    'Turn an approved pitch, founder recording, and real product demo into controlled investor, customer, and recruiting assets.',
  alternates: { canonical: 'https://videoclaw.com/for/demo-day' },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Your Demo Day story should keep working after the pitch.',
    description:
      'A controlled founder-led demo and follow-up system built from one approved story and one real product proof sequence.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
