"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useQuery } from "urql";
import { COMMITTEE_TYPES, SEASONS } from "@/lib/types";
import type { ActiveMembersResponse, ActiveMemberUser, CommitteeType, Season, TeamType } from "@/lib/types";
import SeasonSelect from "@/components/season-select";
import { ACTIVE_MEMBERS_QUERY } from "@/lib/graphql/queries";

const CURRENT_SEASON = SEASONS[0];

const TYPE_ORDER = ["COACH", "HALL_DUTY", ...COMMITTEE_TYPES] as const;

const typeRank = (type: ActiveRow["type"]): number => {
  const idx = TYPE_ORDER.indexOf(type as (typeof TYPE_ORDER)[number]);
  return idx === -1 ? TYPE_ORDER.length : idx;
};

type ActiveRow = {
  key: string;
  type: "COACH" | "HALL_DUTY" | CommitteeType;
  team: TeamType | null;
  user: ActiveMemberUser;
};

export default function ActiveMembersPage() {
  return (
    <Suspense>
      <ActiveMembersContent />
    </Suspense>
  );
}

function ActiveMembersContent() {
  const t = useTranslations("Dashboard.activeMembers");
  const searchParams = useSearchParams();

  const rawSeason = searchParams.get("season");
  const season = SEASONS.includes(rawSeason ?? "")
    ? (rawSeason as Season)
    : CURRENT_SEASON;

  const [{ data: result, error, fetching }] = useQuery<{
    activeMembers: ActiveMembersResponse;
  }>({
    query: ACTIVE_MEMBERS_QUERY,
    variables: { season },
    requestPolicy: "network-only",
  });
  const data = result?.activeMembers;
  const loading = fetching;

  const rows: ActiveRow[] = data
    ? [
        ...data.coaches.map((coach) => ({
          key: `coach-${coach.id}`,
          type: "COACH" as const,
          team: coach.team,
          user: coach.user,
        })),
        ...data.committees.map((committee) => ({
          key: `committee-${committee.id}`,
          type: committee.type,
          team: null as TeamType | null,
          user: committee.user,
        })),
        ...data.hallDuties.map((hallDuty) => ({
          key: `hall-duty-${hallDuty.id}`,
          type: "HALL_DUTY" as const,
          team: null as TeamType | null,
          user: hallDuty.user,
        })),
      ].sort(
        (a, b) =>
          typeRank(a.type) - typeRank(b.type) ||
          (a.user.firstName ?? "").localeCompare(b.user.firstName ?? "") ||
          (a.user.lastName ?? "").localeCompare(b.user.lastName ?? ""),
      )
    : [];

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
            {loading && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-ink-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
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
            {rows.length === 0 && !loading && !error && (
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