import Image from "next/image";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { auth0, authEnabled } from "@/lib/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = authEnabled() ? await auth0.getSession() : null;
  const isLoggedIn = Boolean(session);

  return <HomeContent isLoggedIn={isLoggedIn} session={session} />;
}

function HomeContent({
  isLoggedIn,
  session,
}: {
  isLoggedIn: boolean;
  session: Awaited<ReturnType<typeof auth0.getSession>> | null;
}) {
  const t = useTranslations("Home");

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative flex min-h-[70svh] items-center justify-center overflow-hidden bg-accent">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/30" />
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-24 text-center text-white sm:px-6">
          <Image
            src="/Logo_US_DEF_mettekst.svg"
            alt="US Basketball"
            width={180}
            height={220}
            className="mx-auto mb-8 h-32 w-auto invert sm:h-40"
            priority
          />
          <h1 className="font-display text-6xl uppercase leading-none tracking-wide sm:text-7xl lg:text-8xl">
            {t("hero.title")}
          </h1>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.3em] text-white/80 sm:text-base">
            {t("hero.tagline")}
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md px-4 py-16 sm:px-6 sm:py-20">
        <div className="border border-line bg-white p-8">
          {isLoggedIn ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-ink">
                {t("welcome.title")}, {session?.user?.name ?? "User"}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                {session?.user?.email}
              </p>
              <a
                href="/auth/logout"
                className="mt-8 block w-full bg-accent px-6 py-4 text-center text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-darker"
              >
                {t("welcome.logout")}
              </a>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="font-display text-3xl uppercase tracking-wide text-ink sm:text-4xl">
                {t("login.title")}
              </h2>
              <p className="mt-3 text-sm text-ink-muted">
                {t("login.description")}
              </p>
              <a
                href="/auth/login"
                className="mt-8 block w-full bg-accent px-6 py-4 text-center text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-darker"
              >
                {t("login.button")}
              </a>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-center">
          <LocaleSwitcher />
        </div>
      </section>
    </div>
  );
}
