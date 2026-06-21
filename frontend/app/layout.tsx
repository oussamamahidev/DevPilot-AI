import type { Metadata, Viewport } from "next";
import { Providers } from "@/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevPilot AI",
  description: "Secure multi-workspace document intelligence platform",
};

export const viewport: Viewport = {
  initialScale: 1,
  width: "device-width",
};

// Set the theme class before paint to prevent a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('dp-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
