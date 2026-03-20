import MapClient from "../../(dashboard)/map/[courseId]/MapClient";

export default function CourseMapPage({
  params,
}: {
  params: { courseId: string };
}) {
  return <MapClient courseId={params.courseId} />;
}
