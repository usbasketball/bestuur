import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bestuur",
  description: "US Basketball bestuur portal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
