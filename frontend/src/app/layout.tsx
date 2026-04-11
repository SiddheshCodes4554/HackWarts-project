import type { Metadata } from "next";
import "./globals.css";
import { LocationProvider } from "../context/LocationContext";
import { UserProvider } from "../context/UserContext";
import RootLayoutClient from "./layout-client";

export const metadata: Metadata = {
  title: "FarmEase 🌾 - Your AI Farming Assistant",
  description: "FarmEase provides an AI assistant experience for practical farming support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <UserProvider>
          <LocationProvider>
            <RootLayoutClient>{children}</RootLayoutClient>
          </LocationProvider>
        </UserProvider>
      </body>
    </html>
  );
}
