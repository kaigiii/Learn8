import { Suspense } from "react";

import ProfilePageClient from "./ProfilePageClient";

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageClient />
    </Suspense>
  );
}
