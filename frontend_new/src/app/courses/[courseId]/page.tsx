import CourseMapPageClient from "@/features/course-map/CourseMapPageClient";

export default function CourseMapPage({
  params,
}: {
  params: { courseId: string };
}) {
  return <CourseMapPageClient courseId={params.courseId} />;
}
