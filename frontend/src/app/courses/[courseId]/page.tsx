import CourseMapPageClient from "./CourseMapPageClient";

export default function CourseMapPage({
  params,
}: {
  params: { courseId: string };
}) {
  return <CourseMapPageClient courseId={params.courseId} />;
}
