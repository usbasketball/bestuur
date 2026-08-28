import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatFieldType, foysMatchUrl } from "@/lib/types";
import SeasonSelect from "@/components/season-select";

const SEASONS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
  "2022-2023",
  "2021-2022",
  "2020-2021",
  "2019-2020",
  "2018-2019",
  "2017-2018",
];

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ season?: string }>;
};

export default async function MatchesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { season: rawSeason } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.matches");

  const season = SEASONS.includes(rawSeason ?? "") ? rawSeason! : SEASONS[0];

  if (!rawSeason || !SEASONS.includes(rawSeason)) {
    redirect(`/dashboard/matches?season=${season}`);
  }

  const homeTeams = await db.orm.public.CompetitionTeam.select(
    "foysTeamId",
    "name",
    "teamType",
  )
    .where((t) => t.season.eq(season))
    .all();

  const homeTeamByFoysId = new Map(
    homeTeams.map((t) => [t.foysTeamId, t.name ?? t.teamType] as const),
  );

  const matches = await db.orm.public.Match.select(
    "id",
    "foysMatchId",
    "status",
    "date",
    "startTime",
    "homeScore",
    "awayScore",
    "homeTeamFoysId",
    "awayTeamFoysId",
    "awayTeamName",
    "awayOrganisationName",
    "field",
  )
    .where((m) => m.homeTeamFoysId.in([...homeTeamByFoysId.keys()]))
    .orderBy([(m) => m.date.asc(), (m) => m.startTime.asc()])
    .all();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <SeasonSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: matches.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.date")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.time")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.homeTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.awayTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.score")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.status")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.field")}</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => {
              const homeLabel =
                homeTeamByFoysId.get(match.homeTeamFoysId) ??
                String(match.homeTeamFoysId);
              const awayLabel = match.awayOrganisationName
                ? `${match.awayOrganisationName} - ${match.awayTeamName}`
                : match.awayTeamName ?? String(match.awayTeamFoysId);
              const score =
                match.homeScore != null
                  ? `${match.homeScore} – ${match.awayScore}`
                  : "—";

              return (
                <tr key={match.id} className="border-b border-line/50">
                  <td className="py-3 pr-4">
                    <a
                      href={foysMatchUrl(match.foysMatchId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-ink-muted transition-colors hover:text-accent"
                      aria-label={t("openInFoys")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-ink">
                    {match.date.toPlainDate().toString()}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {match.startTime?.slice(0, 5) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-ink">{homeLabel}</td>
                  <td className="py-3 pr-4 text-ink-muted">{awayLabel}</td>
                  <td className="py-3 pr-4 font-mono text-ink">{score}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium ${
                        match.status === "FINAL"
                          ? "bg-green-100 text-green-800"
                          : match.status === "PLANNED"
                            ? "bg-blue-100 text-blue-800"
                            : match.status === "CANCELLED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {match.status}
                    </span>
                  </td>
                  <td className="py-3 text-ink-muted">
                    {formatFieldType(match.field) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
