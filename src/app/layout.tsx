import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
export const metadata: Metadata = { title: "Draftly — A little space for big ideas", description: "A thoughtful workspace for writing and sharing documents. Demo application." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<Toaster position="bottom-right" richColors closeButton /></body></html>; }
