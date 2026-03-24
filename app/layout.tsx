import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { PWARegister } from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wealth Management",
  description: "Personal wealth management dashboard",
  manifest: "/wealth-management/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk" className={`${geistSans.variable} ${instrumentSerif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/wealth-management/icon-192.png" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppProvider>
            {children}
            <Toaster richColors position="top-right" />
            <PWARegister />
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
