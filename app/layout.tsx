import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./ClientLayout";
import AlienAvatar from "@/components/AlienAvatar"; // 👽 import your avatar
import PresenceBubble from "@/components/PresenceBubble";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <title>Mohammad Hawa - UI/UX Designer Portfolio</title>
        <meta
          name="description"
          content="Professional UI/UX Designer specializing in web and mobile applications"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className={`${inter.className} h-full`}>
        <ClientLayout>{children}</ClientLayout>
        <AlienAvatar /> {/* 🛸 Global floating UX alien */}
      </body>
    </html>
  );
}
