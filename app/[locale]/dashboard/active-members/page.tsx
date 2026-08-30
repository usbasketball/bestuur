import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { COMMITTEE_TYPES, SEASONS, type CommitteeType, type Season, type TeamType } from "@/lib/types";
import SeasonSelect from "@/components/season-select";

const CURRENT_SEASON = SEASONS[0];

const TYPE_ORDER = ["COACH", "HALL_DUTY", ...COMMITTEE_TYPES] as const;

const typeRank = (type: ActiveRow["type"]): number => {
  const idx = TYPE_ORDER.indexOf(type as (typeof TYPE_ORDER)[number]);
  return idx === -1 ? TYPE_ORDER.length : idx;
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ season?: string }>;
};

type UserInfo = {
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
};

type ActiveRow = {
  key: string;
  type: "COACH" | "HALL_DUTY" | CommitteeType;
  team: TeamType | null;
  user: UserInfo;
};

export default async function ActiveMembersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { season: rawSeason } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.activeMembers");

  const season =
    rawSeason && SEASONS.includes(rawSeason as Season) ? (rawSeason as Season) : CURRENT_SEASON;

  const coachesQuery = db.orm.public.Coach.select("id", "team", "season").include("user", (u) =>
    u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
  );
  const committeesQuery = db.orm.public.Committee.select("id", "type", "season").include(
    "user",
    (u) => u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
  );
  const hallDutiesQuery = db.orm.public.HallDuty.select("id", "season").include("user", (u) =>
    u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
  );

  const [coaches, committees, hallDuties] = await Promise.all([
    coachesQuery.where((c) => c.season.eq(season)).all(),
    committeesQuery.where((c) => c.season.eq(season)).all(),
    hallDutiesQuery.where((h) => h.season.eq(season)).all(),
  ]);

  const rows: ActiveRow[] = [
    ...coaches.map((coach) => ({
      key: `coach-${coach.id}`,
      type: "COACH" as const,
      team: coach.team,
      user: coach.user,
    })),
    ...committees.map((committee) => ({
      key: `committee-${committee.id}`,
      type: committee.type,
      team: null as TeamType | null,
      user: committee.user,
    })),
    ...hallDuties.map((hallDuty) => ({
      key: `hall-duty-${hallDuty.id}`,
      type: "HALL_DUTY" as const,
      team: null as TeamType | null,
      user: hallDuty.user,
    })),
  ].sort((a, b) =>
    typeRank(a.type) - typeRank(b.type) ||
    (a.user.firstName ?? "").localeCompare(b.user.firstName ?? "") ||
    (a.user.lastName ?? "").localeCompare(b.user.lastName ?? ""),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <SeasonSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: rows.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.nbb")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.type")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.team")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line/50">
                <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                  {row.user.nbbNumber ?? "—"}
                </td>
                <td className="py-3 pr-4 text-ink">
                  {[row.user.firstName, row.user.lastNamePrefix, row.user.lastName]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </td>
                <td className="py-3 pr-4 text-ink-muted">{t(`types.${row.type}`)}</td>
                <td className="py-3 font-mono text-ink">
                  {row.team ?? ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-ink-muted">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}