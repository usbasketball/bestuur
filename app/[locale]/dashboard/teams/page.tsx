import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { pool } from "@/lib/db";

type Props = {
  params: Promise<{ locale: string }>;
};

type Team = {
  id: string;
  foys_team_id: number;
  name: string | null;
  season: string;
  team_type: string;
  discipline: string;
};

export default async function TeamsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.teams");

  const { rows } = await pool.query<Team>(
    `SELECT id, foys_team_id, name, season, team_type, discipline
     FROM competition_teams
     ORDER BY season DESC, team_type`
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
        {t("title")}
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: rows.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="pb-3 pr-4 font-medium">{t("columns.type")}</th>
              <th className="pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="pb-3 pr-4 font-medium">{t("columns.season")}</th>
              <th className="pb-3 pr-4 font-medium">{t("columns.discipline")}</th>
              <th className="pb-3 font-medium">{t("columns.foysId")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((team) => (
              <tr key={team.id} className="border-b border-line/50">
                <td className="py-3 pr-4 font-mono text-ink">{team.team_type}</td>
                <td className="py-3 pr-4 text-ink">{team.name ?? "—"}</td>
                <td className="py-3 pr-4 text-ink-muted">{team.season}</td>
                <td className="py-3 pr-4 text-ink-muted">{team.discipline}</td>
                <td className="py-3 font-mono text-xs text-ink-muted">
                  {team.foys_team_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
