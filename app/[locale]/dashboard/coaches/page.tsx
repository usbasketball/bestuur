import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CoachesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.coaches");

  const coaches = await db.orm.public.Coach.select("id", "team", "season")
    .include("user", (u) =>
      u.select("firstName", "lastNamePrefix", "lastName", "email", "nbbNumber"),
    )
    .orderBy([(c) => c.season.desc(), (c) => c.team.asc()])
    .all();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: coaches.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.team")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.email")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.nbb")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.season")}</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((coach) => (
              <tr key={coach.id} className="border-b border-line/50">
                <td className="py-3 pr-4 font-mono text-ink">{coach.team}</td>
                <td className="py-3 pr-4 text-ink">
                  {[coach.user.firstName, coach.user.lastNamePrefix, coach.user.lastName]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </td>
                <td className="py-3 pr-4 text-ink-muted">{coach.user.email}</td>
                <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                  {coach.user.nbbNumber ?? "—"}
                </td>
                <td className="py-3 text-ink-muted">{coach.season}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}