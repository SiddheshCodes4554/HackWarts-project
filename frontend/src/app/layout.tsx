import type { Metadata } from "next";
import "./globals.css";
import { LocationProvider } from "../context/LocationContext";
import { UserProvider } from "../context/UserContext";
import RootLayoutClient from "./layout-client";

export const metadata: Metadata = {
  title: "FarmEase - AI Farm Assistant",
  description: "FarmEase turns weather, soil, and market signals into actionable farm decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <UserProvider>
          <LocationProvider>
            <RootLayoutClient>{children}</RootLayoutClient>
          </LocationProvider>
        </UserProvider>
      </body>
    </html>
  );
}
