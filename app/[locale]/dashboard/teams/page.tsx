import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { foysTeamUrl, formatDiscipline } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TeamsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.teams");

  const teams = await db.orm.public.CompetitionTeam.select(
    "id",
    "foysTeamId",
    "name",
    "season",
    "teamType",
    "discipline",
  )
    .orderBy([(t) => t.season.desc(), (t) => t.teamType.asc()])
    .all();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: teams.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.type")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.season")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.discipline")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.foysId")}</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b border-line/50">
                <td className="py-3 pr-4">
                  <a
                    href={foysTeamUrl(team.foysTeamId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-ink-muted transition-colors hover:text-accent"
                    aria-label={t("openInFoys")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </td>
                <td className="py-3 pr-4 font-mono text-ink">{team.teamType}</td>
                <td className="py-3 pr-4 text-ink">{team.name ?? "—"}</td>
                <td className="py-3 pr-4 text-ink-muted">{team.season}</td>
                <td className="py-3 pr-4 text-ink-muted">{formatDiscipline(team.discipline)}</td>
                <td className="py-3 font-mono text-xs text-ink-muted">
                  {team.foysTeamId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
