import { Suspense } from "react";
import ArenaQueuePageClient from "@/features/arena/ArenaQueuePageClient";

export default function ArenaQueuePage() {
  return (
    <Suspense fallback={null}>
      <ArenaQueuePageClient />
    </Suspense>
  );
}
