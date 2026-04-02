import LessonResultPageClient from "@/features/lesson-session/LessonResultPageClient";

export default function CourseNodeResultPage({
  params,
}: {
  params: { courseId: string; nodeId: string };
}) {
  return <LessonResultPageClient courseId={params.courseId} nodeId={params.nodeId} />;
}
