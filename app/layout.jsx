import './globals.css';

export const metadata = {
  title: 'edge-bench — hosting latency, measured continuously',
  description:
    'An open, continuously-updated latency benchmark of Vercel, Netlify, Cloudflare and GitHub Pages, measured from real probes on six continents.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
