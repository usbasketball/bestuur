"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { ExternalLink, Pencil, Check, X } from "lucide-react";
import { useQuery, useMutation } from "urql";
import { foysMatchUrl, formatFieldType, abbreviateTeamType, SEASONS } from "@/lib/types";
import SeasonSelect from "@/components/season-select";
import { MATCHES_QUERY, MEMBERS_QUERY, UPSERT_TASK_ASSIGNMENT_MUTATION } from "@/lib/graphql/operations";
import type { MatchesResponse, MembersResponse, Member, TaskAssignee } from "@/lib/types";

export default function TasksPage() {
  return (
    <Suspense>
      <TasksContent />
    </Suspense>
  );
}

function TasksContent() {
  const t = useTranslations("Dashboard.tasks");
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawSeason = searchParams.get("season");
  const season = SEASONS.includes(rawSeason ?? "") ? rawSeason! : SEASONS[0];

  useEffect(() => {
    if (!rawSeason || !SEASONS.includes(rawSeason)) {
      router.replace(`/dashboard/tasks?season=${SEASONS[0]}`);
    }
  }, [rawSeason, router]);

  const [matchesResult] = useQuery<{ matches: MatchesResponse }>({
    query: MATCHES_QUERY,
    variables: { season },
    requestPolicy: "network-only",
  });
  const [membersResult] = useQuery<{ members: MembersResponse }>({
    query: MEMBERS_QUERY,
    variables: { season },
    requestPolicy: "network-only",
  });

  const loading = matchesResult.fetching;
  const matches = matchesResult.data?.matches ?? [];
  const members = useMemo(() => membersResult.data?.members ?? [], [membersResult.data]);

  const rows = matches
    .filter((m) => m.tasks)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );

  const assigneeName = (
    assignee: TaskAssignee | null | undefined,
    options?: { isReferee?: boolean; homeTeam?: string | null },
  ): string => {
    const member = assignee?.member;
    if (!member?.user) {
      if (options?.isReferee && ["H1", "H2", "D1"].includes(abbreviateTeamType(options.homeTeam))) {
        return "NBB";
      }
      return "TBD";
    }
    const { user, primaryTeam } = member;
    return `${abbreviateTeamType(primaryTeam)} ${user.firstName}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl uppercase tracking-wide text-ink">
          {t("title")}
        </h1>
        <SeasonSelect />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {t("count", { count: rows.length })}
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-muted">
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium" aria-label={t("openInFoys")} />
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.date")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.time")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.homeTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.awayTeam")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.field")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.hallDuty")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.ref1")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.ref2")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.tableScorer")}</th>
              <th className="sticky top-0 bg-white pb-3 pr-4 font-medium">{t("columns.tableTimer")}</th>
              <th className="sticky top-0 bg-white pb-3 font-medium">{t("columns.table24s")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-ink-muted">
                  {t("loading")}
                </td>
              </tr>
            )}
            {matchesResult.error && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-red-600">
                  {t("error")}
                </td>
              </tr>
            )}
            {rows.map((match) => {
              const awayLabel = match.awayTeam?.organisation
                ? `${match.awayTeam.organisation.name} - ${match.awayTeam.name}`
                : (match.awayTeam?.name ?? null);
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
                  <td className="whitespace-nowrap py-3 pr-4 text-ink">{match.date}</td>
                  <td className="py-3 pr-4 text-ink-muted">
                    {match.startTime?.slice(0, 5) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-ink">{abbreviateTeamType(match.homeTeam) || "—"}</td>
                  <td className="py-3 pr-4 text-ink-muted">{awayLabel ?? "—"}</td>
                  <td className="py-3 pr-4 text-ink-muted">{formatFieldType(match.field)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-muted">
                    <EditableAssignmentCell
                      assignee={match.tasks?.hallDuty}
                      members={members}
                      season={season}
                      displayText={assigneeName(match.tasks?.hallDuty)}
                    />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink">
                    <EditableAssignmentCell
                      assignee={match.tasks?.referee1}
                      members={members}
                      season={season}
                      displayText={assigneeName(match.tasks?.referee1, { isReferee: true, homeTeam: match.homeTeam })}
                    />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink">
                    <EditableAssignmentCell
                      assignee={match.tasks?.referee2}
                      members={members}
                      season={season}
                      displayText={assigneeName(match.tasks?.referee2, { isReferee: true, homeTeam: match.homeTeam })}
                    />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-muted">
                    <EditableAssignmentCell
                      assignee={match.tasks?.scorer}
                      members={members}
                      season={season}
                      displayText={assigneeName(match.tasks?.scorer)}
                    />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-ink-muted">
                    <EditableAssignmentCell
                      assignee={match.tasks?.timer}
                      members={members}
                      season={season}
                      displayText={assigneeName(match.tasks?.timer)}
                    />
                  </td>
                  <td className="whitespace-nowrap py-3 text-ink-muted">
                    {["D1", "D2", "D3", "H1", "H2", "H3", "H4"].includes(abbreviateTeamType(match.homeTeam))
                      ? (
                        <EditableAssignmentCell
                          assignee={match.tasks?.shotClock}
                          members={members}
                          season={season}
                          displayText={assigneeName(match.tasks?.shotClock)}
                        />
                      )
                      : "—"}
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

function EditableAssignmentCell({
  assignee,
  members,
  displayText,
  season,
}: {
  assignee: TaskAssignee | null | undefined;
  members: Member[];
  displayText: string;
  season: string;
}) {
  const [, upsertAssignment] = useMutation(UPSERT_TASK_ASSIGNMENT_MUTATION);
  const [editing, setEditing] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const assignmentId = assignee?.assignmentId ?? null;
  const taskId = assignee?.taskId ?? null;
  const currentUserId = assignee?.member?.id ?? null;
  const isDraft = assignee?.status === "DRAFT";

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const teamA = abbreviateTeamType(a.primaryTeam) ?? "";
        const teamB = abbreviateTeamType(b.primaryTeam) ?? "";
        if (teamA !== teamB) return teamA.localeCompare(teamB);
        const firstA = (a.user.firstName ?? "").toLowerCase();
        const firstB = (b.user.firstName ?? "").toLowerCase();
        return firstA.localeCompare(firstB);
      }),
    [members],
  );

  const handleSave = useCallback(() => {
    if (!assignmentId || !taskId) return;
    const memberId = selectedMemberId || null;
    startTransition(() => {
      void upsertAssignment({
        assignmentId,
        taskId,
        memberId,
        season,
      }).then(() => {
        setEditing(false);
      });
    });
  }, [assignmentId, taskId, selectedMemberId, season, upsertAssignment]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setSelectedMemberId("");
  }, []);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <select
          value={selectedMemberId}
          onChange={(e) => setSelectedMemberId(e.target.value)}
          className="border border-line bg-white px-1 py-0.5 text-[11px] text-ink"
        >
          <option value="">TBD</option>
          {sortedMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {abbreviateTeamType(m.primaryTeam)} {m.user.firstName} {m.user.lastNamePrefix ?? ""} {m.user.lastName ?? ""}
            </option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex text-green-600 transition-colors hover:text-green-800 disabled:opacity-50"
          aria-label="Save"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="inline-flex text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <span className="group inline-flex items-center gap-1">
      {displayText}
      {isDraft && assignmentId && taskId && (
        <button
          onClick={() => {
            setSelectedMemberId(currentUserId ?? "");
            setEditing(true);
          }}
          className="inline-flex text-ink-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
          aria-label="Edit assignment"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
