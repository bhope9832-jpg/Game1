import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Navbar } from "@/components/navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VidForge — AI Video Generation Studio",
    template: "%s · VidForge",
  },
  description:
    "Generate stunning AI videos with Seedance 2.0, Kling, Luma Dream Machine and more. Text-to-video and image-to-video, no API keys required.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VidForge",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b12",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <Navbar />
        <main>{children}</main>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
