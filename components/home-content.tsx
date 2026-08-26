"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";

type Props = {
  isLoggedIn: boolean;
  session: {
    user?: { name?: string | null; email?: string | null };
  } | null;
};

const LOCALE_LABELS: Record<string, string> = {
  en: "EN",
  nl: "NL",
};

export function HomeContent({ isLoggedIn, session }: Props) {
  const t = useTranslations("Home");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-accent text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/30" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center">
        <Image
          src="/Logo_US_DEF_mettekst.svg"
          alt="US Basketball"
          width={180}
          height={220}
          className="mb-8 h-32 w-auto invert sm:h-40"
          priority
        />
        <h1 className="font-display text-6xl uppercase leading-none tracking-wide sm:text-7xl lg:text-8xl">
          {t("hero.title")}
        </h1>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.3em] text-white/80 sm:text-base">
          {t("hero.tagline")}
        </p>

        {isLoggedIn ? (
          <a
            href="/auth/logout"
            className="mt-10 inline-block border border-white/30 bg-white/10 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            {t("welcome.logout")}
          </a>
        ) : (
          <a
            href="/auth/login"
            className="mt-10 inline-block border border-white/30 bg-white/10 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            {t("login.button")}
          </a>
        )}

        <p className="mt-16 text-xs text-white/50">
          {t("help.text")}{" "}
          <a
            href="mailto:it@usbasketball.nl"
            className="underline transition-colors hover:text-white/80"
          >
            it@usbasketball.nl
          </a>
        </p>
      </div>

      <div className="relative z-10 pb-8">
        <LocaleSwitcher />
      </div>
    </div>
  );
}

function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: string) {
    if (nextLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div className="flex items-center gap-3 text-xs text-white/40">
      {(["nl", "en"] as const).map((loc, i) => (
        <span key={loc} className="flex items-center gap-3">
          {i > 0 && <span>/</span>}
          <button
            onClick={() => switchLocale(loc)}
            disabled={isPending}
            className={`transition-colors hover:text-white/80 ${
              loc === locale ? "text-white" : ""
            }`}
          >
            {LOCALE_LABELS[loc]}
          </button>
        </span>
      ))}
    </div>
  );
}
