import LessonArenaPageClient from "@/features/arena/LessonArenaPageClient";

export default function CourseNodePage({
  params,
}: {
  params: { courseId: string; nodeId: string };
}) {
  return <LessonArenaPageClient courseId={params.courseId} nodeId={params.nodeId} />;
}
