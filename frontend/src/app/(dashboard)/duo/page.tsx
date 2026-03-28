"use client";

import { useMemo, useState } from "react";
import TopStatsBar from "@/components/layout/TopStatsBar";
import GameButton from "@/components/ui/GameButton";
import { useRouter } from "next/navigation";

type Lobby = {
  id: string;
  name: string;
  players: string;
  online: number;
  icon: string;
};

const LOBBIES: Lobby[] = [
  { id: "l1", name: "Fantasy Quest", players: "2/2", online: 12, icon: "🏰" },
  { id: "l2", name: "Sci-Fi Brawl", players: "1/2", online: 1, icon: "🚀" },
  { id: "l3", name: "Puzzle Challenge", players: "2/2", online: 10, icon: "🧩" },
  { id: "l4", name: "Sci-Fi Challenge", players: "1/2", online: 1, icon: "🪐" },
  { id: "l5", name: "Data Science", players: "1/2", online: 1, icon: "📊" },
  { id: "l6", name: "Fantasy Quest", players: "1/2", online: 1, icon: "🧙" },
];

export default function DuoPage() {
  const router = useRouter();
  const [roomNumber, setRoomNumber] = useState("");
  const [duoQueue, setDuoQueue] = useState(false);

  const estimatedWait = useMemo(() => {
    return duoQueue ? "15 min" : "30 min";
  }, [duoQueue]);

  return (
    <div className="min-h-screen">
      <TopStatsBar backHref="/home" pageTitle="Two-player game" />

      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <h1 className="font-heading text-3xl font-extrabold text-brand-gray-700 md:text-4xl">
          Find Your Match
        </h1>

        <section className="mt-6 grid grid-cols-1 gap-4 md:mt-7 md:grid-cols-2 md:gap-5">
          <div className="rounded-3xl border border-white/70 bg-white/65 p-5 shadow-xl backdrop-blur-md md:p-6">
            <h2 className="font-heading text-3xl font-extrabold text-brand-gray-700">Create a Room</h2>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-brand-gray-600">Room number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Enter room number"
                className="w-full rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-brand-gray-700 shadow-sm outline-none transition focus:border-brand-teal/70"
              />
            </div>

            <GameButton className="mt-5 w-full text-xl">Create Lobby</GameButton>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/65 p-5 shadow-xl backdrop-blur-md md:p-6">
            <h2 className="text-center font-heading text-3xl font-extrabold text-brand-gray-700">
              Random Matchmaking
            </h2>

            <GameButton className="mt-4 w-full text-2xl" pulse onClick={() => router.push("/duo/waiting")}>
              Quick Play
            </GameButton>

            <label className="mt-4 flex items-center justify-center gap-2 text-brand-gray-700">
              <input
                type="checkbox"
                checked={duoQueue}
                onChange={(e) => setDuoQueue(e.target.checked)}
                className="h-4 w-4 rounded border-brand-gray-300"
              />
              <span className="text-sm font-semibold">Duo Queue</span>
            </label>

            <p className="mt-2 text-center text-sm text-brand-gray-500">Estimated Wait time: {estimatedWait}</p>
          </div>
        </section>

        <section className="mt-8 md:mt-10">
          <h2 className="font-heading text-3xl font-extrabold text-brand-gray-700">Active Lobbies</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {LOBBIES.map((lobby) => (
              <article
                key={lobby.id}
                className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-md backdrop-blur"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/20 text-2xl">
                  {lobby.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading text-xl font-bold text-brand-gray-700">
                    {lobby.name} - {lobby.players}
                  </p>
                  <p className="mt-1 text-sm text-brand-gray-500">👥 {lobby.online}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="py-8 text-center text-sm text-brand-gray-400">
          <a href="#" className="transition hover:text-brand-gray-600">About</a>
          <span className="mx-2 text-brand-gray-300">|</span>
          <a href="#" className="transition hover:text-brand-gray-600">Contact</a>
          <span className="mx-2 text-brand-gray-300">|</span>
          <a href="#" className="transition hover:text-brand-gray-600">Privacy</a>
          <span className="mx-2 text-brand-gray-300">|</span>
          <a href="#" className="transition hover:text-brand-gray-600">Terms</a>
        </footer>
      </main>
    </div>
  );
}
