import ArenaClient from "../../../../(arena)/play/[nodeId]/ArenaClient";

export default function CourseNodePage({
  params,
}: {
  params: { courseId: string; nodeId: string };
}) {
  return <ArenaClient courseId={params.courseId} nodeId={params.nodeId} />;
}
