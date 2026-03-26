import LessonResultPageClient from "@/features/arena/LessonResultPageClient";

export default function CourseNodeResultPage({
  params,
}: {
  params: { courseId: string; nodeId: string };
}) {
  return <LessonResultPageClient courseId={params.courseId} nodeId={params.nodeId} />;
}
