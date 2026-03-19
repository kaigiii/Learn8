import { redirect } from "next/navigation";
import ArenaClient from "./ArenaClient";

export default function LegacyPlayPage({
  params,
  searchParams,
}: {
  params: { nodeId: string };
  searchParams: { courseId?: string };
}) {
  if (searchParams.courseId) {
    redirect(`/courses/${searchParams.courseId}/nodes/${params.nodeId}`);
  }
  return <ArenaClient />;
}
