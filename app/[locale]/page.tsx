import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth0, authEnabled } from "@/lib/auth";
import { HomeContent } from "@/components/home-content";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (authEnabled()) {
    const session = await auth0.getSession();
    if (session) {
      redirect({ href: "/dashboard", locale });
    }
  }

  return <HomeContent isLoggedIn={false} session={null} />;
}
