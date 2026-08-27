import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { pool } from "@/lib/db";
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

type Match = {
  id: string;
  foys_match_id: number;
  status: string;
  date: string;
  start_time: string | null;
  home_score: number | null;
  away_score: number | null;
  home_team_foys_id: number;
  away_team_foys_id: number;
  away_team_name: string | null;
  away_organisation_name: string | null;
  field: string | null;
  home_team_name: string | null;
  home_team_type: string | null;
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

  const { rows: matches } = await pool.query<Match>(
    `SELECT m.id, m.foys_match_id, m.status, to_char(m.date, 'YYYY-MM-DD') AS date, m.start_time,
            m.home_score, m.away_score, m.home_team_foys_id, m.away_team_foys_id,
            m.away_team_name, m.away_organisation_name, m.field,
            ct.name AS home_team_name, ct.team_type AS home_team_type
     FROM matches m
     JOIN competition_teams ct ON ct.foys_team_id = m.home_team_foys_id
     WHERE ct.season = $1
     ORDER BY m.date, m.start_time`,
    [season]
  );

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
              const homeLabel = match.home_team_name ?? match.home_team_type ?? String(match.home_team_foys_id);
              const awayLabel = match.away_organisation_name
                ? `${match.away_organisation_name} - ${match.away_team_name}`
                : match.away_team_name ?? String(match.away_team_foys_id);
              const score =
                match.home_score != null
                  ? `${match.home_score} – ${match.away_score}`
                  : "—";

              return (
                <tr key={match.id} className="border-b border-line/50">
                  <td className="py-3 pr-4">
                    <a
                      href={foysMatchUrl(match.foys_match_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-ink-muted transition-colors hover:text-accent"
                      aria-label={t("openInFoys")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-ink">{match.date}</td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {match.start_time?.slice(0, 5) ?? "—"}
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
