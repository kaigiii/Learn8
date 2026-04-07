import ArenaResultPageClient from "@/features/arena/ArenaResultPageClient";

export default function ArenaResultPage({
  params,
}: {
  params: { matchId: string };
}) {
  return <ArenaResultPageClient matchId={Number(params.matchId)} />;
}
