import ArenaLobbyPageClient from "@/features/arena/ArenaLobbyPageClient";

export default function ArenaLobbyPage({
  params,
}: {
  params: { roomCode: string };
}) {
  return <ArenaLobbyPageClient roomCode={params.roomCode} />;
}
