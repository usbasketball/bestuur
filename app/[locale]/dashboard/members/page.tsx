import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { pool } from "@/lib/db";

type Props = {
  params: Promise<{ locale: string }>;
};

type User = {
  id: string;
  email: string;
  first_name: string | null;
  last_name_prefix: string | null;
  last_name: string | null;
  nbb_number: string | null;
  referee_level: string | null;
};

export default async function MembersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Dashboard.members");

  const { rows } = await pool.query<User>(
    `SELECT id, email, first_name, last_name_prefix, last_name, nbb_number, referee_level
     FROM users
     ORDER BY last_name NULLS LAST, first_name NULLS LAST`
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
              <th className="pb-3 pr-4 font-medium">{t("columns.name")}</th>
              <th className="pb-3 pr-4 font-medium">{t("columns.email")}</th>
              <th className="pb-3 pr-4 font-medium">{t("columns.nbb")}</th>
              <th className="pb-3 font-medium">{t("columns.refereeLevel")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-b border-line/50">
                <td className="py-3 pr-4 text-ink">
                  {[user.first_name, user.last_name_prefix, user.last_name]
                    .filter(Boolean)
                    .join(" ")}
                </td>
                <td className="py-3 pr-4 text-ink-muted">{user.email}</td>
                <td className="py-3 font-mono text-xs text-ink-muted">
                  {user.nbb_number ?? "—"}
                </td>
                <td className="py-3 text-ink-muted">
                  {user.referee_level ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
