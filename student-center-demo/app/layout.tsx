import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Student Center Demo',
  description: 'Unofficial demo student center prototype'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
