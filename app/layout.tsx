import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "U.S. Bestuur",
  description: "US Basketball bestuur portal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
