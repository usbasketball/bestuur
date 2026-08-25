import Image from "next/image";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function UnauthorizedPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Unauthorized" });

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Image
        src="/Logo_US_DEF_zondertekst.svg"
        alt="US Basketball"
        width={80}
        height={100}
        className="mb-8 h-20 w-auto opacity-40"
      />
      <h1 className="font-display text-4xl uppercase tracking-wide text-ink sm:text-5xl">
        {t("title")}
      </h1>
      <p className="mt-4 max-w-md text-ink-muted">{t("description")}</p>
      <a
        href="/auth/logout"
        className="mt-10 inline-flex items-center justify-center bg-accent px-10 py-4 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-darker"
      >
        {t("logout")}
      </a>
    </div>
  );
}
