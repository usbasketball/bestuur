"use client";

import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { useQuery } from "urql";
import { TEAM_TYPES, foysMemberUrl, type MembersResponse, type TeamType } from "@/lib/types";
import TeamTypeSelect from "@/components/team-type-select";
import { MEMBERS_QUERY } from "@/lib/graphql/operations";

export default function MembersPage() {
  return (
    <Suspense>
      <MembersContent />
    </Suspense>
  );
}

function MembersContent() {
  const t = useTranslations("Dashboard.members");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [{ data, error, fetching }] = useQuery<{ members: MembersResponse }>({
    query: MEMBERS_QUERY,
    requestPolicy: "network-only",
  });
  const members = data?.members;
  const loading = fetching;

  const rawTeamType = searchParams.get("team_type");
  const teamType =
    rawTeamType && TEAM_TYPES.includes(rawTeamType as TeamType)
      ? (rawTeamType as TeamType)
      : null;

  useEffect(() => {
    if (rawTeamType && !teamType) {
      router.replace("/dashboard/members");
    }
  }, [rawTeamType, teamType, router]);

  const sortedMembers = members ? [...members].sort((a, b) => {
    const teamA = a.primaryTeam;
    const teamB = b.primaryTeam;
    if (teamA && teamB) {
      if (teamA !== teamB) return teamA.localeCompare(teamB);
      return (a.user.firstName ?? "").localeCompare(b.user.firstName ?? "");
    }
    if (teamA) return -1;
    if (teamB) return 1;
    return 0;
  }) : [];

  const filteredMembers = teamType
    ? sortedMembers.filter((m) => m.primaryTeam === teamType)
    : sortedMembers;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <TeamTypeSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: filteredMembers.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.primaryTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.email")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.nbb")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.coachedTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.committees")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.refereeLevel")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.memberSince")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-ink-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {filteredMembers.map((member) => {
              const { user } = member;
              return (
                <tr key={member.id} className="border-b border-line/50">
                  <td className="py-3 pr-4">
                    {user.foysUserId && (
                      <a
                        href={foysMemberUrl(user.foysUserId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-ink-muted transition-colors hover:text-accent"
                        aria-label={t("openInFoys")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-ink">
                    {member.primaryTeam ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-ink">
                    {[user.firstName, user.lastNamePrefix, user.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">{user.email}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                    {user.nbbNumber ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-mono text-ink">
                    {member.coachingTeams.length > 0
                      ? member.coachingTeams.join(", ")
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {member.committees.length > 0
                      ? member.committees.join(", ")
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {user.refereeLevel ?? "—"}
                  </td>
                  <td className="py-3 text-ink-muted">
                    {user.memberSince ?? "—"}
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
