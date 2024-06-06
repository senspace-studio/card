import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Joker Meme',
  description: 'Generate joker card from your casts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
