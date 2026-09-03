"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useQuery } from "urql";
import { SEASONS } from "@/lib/types";
import type { ActiveMembersResponse, Season } from "@/lib/types";
import SeasonSelect from "@/components/season-select";
import { graphql } from "@/lib/graphql/generated";

const ACTIVE_MEMBERS_QUERY = graphql(`
  query ActiveMembers($season: String) {
    activeMembers(season: $season) {
      id
      season
      primaryTeam
      coachingTeams
      committees
      user {
        email
        firstName
        lastNamePrefix
        lastName
        nbbNumber
        refereeLevel
        foysUserId
        memberSince
      }
    }
  }
`);

const CURRENT_SEASON = SEASONS[0];

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
  const members = result?.activeMembers;
  const loading = fetching;

  const rows = members
    ? [...members].sort(
        (a, b) =>
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
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.email")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.primaryTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.coachingTeams")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {rows.map((member) => (
              <tr key={member.id} className="border-b border-line/50">
                <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                  {member.user.nbbNumber ?? "—"}
                </td>
                <td className="py-3 pr-4 text-ink">
                  {[member.user.firstName, member.user.lastNamePrefix, member.user.lastName]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </td>
                <td className="py-3 pr-4 text-ink-muted">{member.user.email}</td>
                <td className="py-3 pr-4 font-mono text-ink">
                  {member.primaryTeam ?? "—"}
                </td>
                <td className="py-3 font-mono text-ink">
                  {member.coachingTeams.length > 0
                    ? member.coachingTeams.join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-muted">
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
