import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Bestuur",
  description: "US Basketball bestuur portal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <Analytics />
    </>
  );
}
