import type { Metadata } from "next";
import "./globals.css";
import LanguageHtmlUpdater from "@/components/i18n/LanguageHtmlUpdater";

export const metadata: Metadata = {
  title: "Learn8",
  description: "Convert your notes into a dynamic Skill Tree and master any subject through immersive mini-games.",
  icons: {
    icon: "/icons/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen app-shared-bg antialiased">
        <LanguageHtmlUpdater />
        {children}
      </body>
    </html>
  );
}
