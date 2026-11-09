import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { TeamForm } from "@/components/team-form";

export const Route = createFileRoute("/_authenticated/teams/$id/edit")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Edit team — Assessor" }, { name: "description", content: "Edit team information." }, { property: "og:title", content: "Edit team — Assessor" }, { property: "og:description", content: "Edit team information." }] }),
  component: Edit,
});

function Edit() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["team-edit", id],
    queryFn: async () => {
      const [t, m] = await Promise.all([supabase.from("teams").select("*").eq("id", id).single(), supabase.from("team_members").select("*").eq("team_id", id).order("position")]);
      return { team: t.data!, members: (m.data ?? []).map((x) => ({ name: x.name, email: x.email ?? "" })) };
    },
  });
  if (!q.data) return <div className="glass h-96 animate-pulse rounded-2xl" />;
  return (
    <>
      <PageHeader title={`Edit ${q.data.team.name}`} />
      <TeamForm team={q.data.team} members={q.data.members} />
    </>
  );
}
