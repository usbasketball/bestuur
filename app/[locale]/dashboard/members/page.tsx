"use client";

import { Suspense, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { CLUB_MEMBERSHIP_TYPES, foysMemberUrl, TEAM_TYPES } from "@/lib/types";
import type { ClubMembershipType, MembersResponse, TeamType } from "@/lib/types";
import TeamTypeSelect from "@/components/team-type-select";
import { useApiData } from "@/lib/use-api";

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
  const { data: users, error, loading } = useApiData<MembersResponse>("/api/members");

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

  const membershipRank = (type: ClubMembershipType | null | undefined): number => {
    if (!type) return CLUB_MEMBERSHIP_TYPES.length;
    const idx = CLUB_MEMBERSHIP_TYPES.indexOf(type);
    return idx === -1 ? CLUB_MEMBERSHIP_TYPES.length : idx;
  };

  const sortedUsers = users ? [...users].sort((a, b) => {
    const teamA = a.memberships[0]?.primaryTeam;
    const teamB = b.memberships[0]?.primaryTeam;
    if (teamA && teamB) {
      if (teamA !== teamB) return teamA.localeCompare(teamB);
      return (
        membershipRank(a.memberships[0]?.membershipType) -
        membershipRank(b.memberships[0]?.membershipType)
      );
    }
    if (teamA) return -1;
    if (teamB) return 1;
    return 0;
  }) : [];

  const filteredUsers = teamType
    ? sortedUsers.filter((u) => u.memberships[0]?.primaryTeam === teamType)
    : sortedUsers;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <TeamTypeSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: filteredUsers.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th
                className="sticky top-0 bg-white pb-3 pr-4 font-medium"
                title={t("membershipTypes.COMPETITION")}
              >
                {t("columns.membershipType")}
              </th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.primaryTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.email")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.nbb")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.coachedTeam")}</th>
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
            {filteredUsers.map((user) => {
              const membership = user.memberships[0];
              const membershipType = membership?.membershipType ?? null;
              const primaryTeam = membership?.primaryTeam ?? null;
              return (
                <tr key={user.id} className="border-b border-line/50">
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
                  <td className="py-3 pr-4">
                    {membershipType === "COMPETITION" && (
                      <span title={t("membershipTypes.COMPETITION")}>
                        <Check
                          className="h-4 w-4 text-accent"
                          aria-label={t("membershipTypes.COMPETITION")}
                        />
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-ink">
                    {primaryTeam ?? "—"}
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
                    {user.coaches.length > 0
                      ? user.coaches.map((c) => c.team).join(", ")
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