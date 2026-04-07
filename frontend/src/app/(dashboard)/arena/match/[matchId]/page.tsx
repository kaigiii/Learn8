import ArenaMatchPageClient from "@/features/arena/ArenaMatchPageClient";

export default function ArenaMatchPage({
  params,
}: {
  params: { matchId: string };
}) {
  return <ArenaMatchPageClient matchId={Number(params.matchId)} />;
}
