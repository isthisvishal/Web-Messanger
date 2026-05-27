import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Messenger — Zero-Knowledge Encrypted Messaging",
  description:
    "End-to-end encrypted messaging where the server never sees your messages. Built with zero-knowledge architecture.",
  keywords: ["encrypted messaging", "zero-knowledge", "e2e encryption", "secure chat"],
  authors: [{ name: "Web Messenger" }],
  openGraph: {
    title: "Web Messenger — Zero-Knowledge Encrypted Messaging",
    description: "The server never sees your messages. True end-to-end encryption.",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") || undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
