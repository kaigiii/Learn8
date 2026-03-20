import ResultClient from "../../../../../(arena)/play/[nodeId]/result/ResultClient";

export default function CourseNodeResultPage({
  params,
}: {
  params: { courseId: string; nodeId: string };
}) {
  return <ResultClient courseId={params.courseId} nodeId={params.nodeId} />;
}
