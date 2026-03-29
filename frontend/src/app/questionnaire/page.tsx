import { Suspense } from "react";
import QuestionnairePageClient from "@/features/questionnaire/QuestionnairePageClient";

export default function QuestionnairePage() {
  return (
    <Suspense fallback={null}>
      <QuestionnairePageClient />
    </Suspense>
  );
}
