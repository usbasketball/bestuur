import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Dashboard" });
  return { title: t("title") };
}

const TABS = [
  { key: "members", href: "/dashboard/members" },
  { key: "games", href: "/dashboard/games" },
] as const;

export default async function DashboardLayout({ params, children }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DashboardShell>{children}</DashboardShell>;
}

async function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-4 sm:px-6">
          <Link href="/dashboard" className="font-display text-xl uppercase tracking-wide text-ink">
            Bestuur
          </Link>
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-paper hover:text-ink"
              >
                {t(`tabs.${tab.key}`)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <a
              href="/auth/logout"
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {t("logout")}
            </a>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
