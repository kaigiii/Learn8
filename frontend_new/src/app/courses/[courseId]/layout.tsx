import CourseFlowLayoutShell from "./CourseFlowLayoutShell";

export default function CourseFlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CourseFlowLayoutShell>{children}</CourseFlowLayoutShell>;
}
