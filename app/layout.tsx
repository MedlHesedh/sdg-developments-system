import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar"; // Ensure correct path
import { SidebarProvider } from "@/components/ui/sidebar"; // Ensure correct path
import { ClerkProvider, SignedIn } from '@clerk/nextjs';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SDG Developments",
  description: "SDG Developments app",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Add any head elements here */}
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} flex h-screen`}>
          <SidebarProvider>
            <div className="flex h-screen w-full">
              {/* Sidebar */}
                <ClerkProvider>
                <SignedIn>
                  <AppSidebar />
                </SignedIn>
                </ClerkProvider>

              {/* Main Content */}
              <main className="flex-1 p-4 overflow-auto">
                {children}
              </main>
            </div>
          </SidebarProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
