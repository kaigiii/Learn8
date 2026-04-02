import LessonSessionPageClient from "@/features/lesson-session/LessonSessionPageClient";

export default function CourseNodePage({
  params,
}: {
  params: { courseId: string; nodeId: string };
}) {
  return <LessonSessionPageClient courseId={params.courseId} nodeId={params.nodeId} />;
}
