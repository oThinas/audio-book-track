import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AudioBook Track",
  description: "Gerenciamento de audiobooks e pagamentos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Keep color list in sync with PRIMARY_COLORS from lib/domain/user-preference.ts */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Inline blocking script to apply primary color before first paint, preventing FOUC. Same pattern as next-themes.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem("primary-color");if(c&&["blue","orange","green","red","amber"].indexOf(c)!==-1){document.documentElement.setAttribute("data-primary-color",c)}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
