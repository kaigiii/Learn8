import { redirect } from "next/navigation";
import ResultClient from "./ResultClient";

export default function LegacyResultPage({
  params,
  searchParams,
}: {
  params: { nodeId: string };
  searchParams: { courseId?: string };
}) {
  if (searchParams.courseId) {
    redirect(`/courses/${searchParams.courseId}/nodes/${params.nodeId}/result`);
  }
  return <ResultClient />;
}
