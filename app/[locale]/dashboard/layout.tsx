import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Users, Trophy, Shield, GraduationCap, ClipboardList, LogOut } from "lucide-react";
import Image from "next/image";
import { GraphqlProvider } from "@/components/graphql-provider";

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
  { key: "members", href: "/dashboard/members", icon: Users },
  { key: "teams", href: "/dashboard/teams", icon: Shield },
  { key: "activeMembers", href: "/dashboard/active-members", icon: GraduationCap },
  { key: "matches", href: "/dashboard/matches", icon: Trophy },
  { key: "tasks", href: "/dashboard/tasks", icon: ClipboardList },
] as const;

export default async function DashboardLayout({ params, children }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <GraphqlProvider>
      <DashboardShell>{children}</DashboardShell>
    </GraphqlProvider>
  );
}

async function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="flex w-14 shrink-0 flex-col items-center border-r border-line bg-black py-3">
        <div className="mb-4">
          <Link href="/dashboard">
            <Image
              src="/Logo_US_DEF_zondertekst.svg"
              alt="US Basketball"
              width={28}
              height={34}
              priority
              className="invert"
            />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              title={t(`tabs.${tab.key}`)}
              className="flex h-9 w-9 items-center justify-center text-paper/60 transition-colors hover:bg-white/10 hover:text-paper"
            >
              <tab.icon className="h-5 w-5" />
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Link
            href="/auth/logout"
            title={t("logout")}
            className="flex h-9 w-9 items-center justify-center text-paper/60 transition-colors hover:bg-white/10 hover:text-paper"
          >
            <LogOut className="h-5 w-5" />
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
