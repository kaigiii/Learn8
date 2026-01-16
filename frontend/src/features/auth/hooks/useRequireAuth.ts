
import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireAuth() {
    const { token, user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!token) {
            router.push("/login");
        }
    }, [token, router]);

    return { user, isAuthenticated: !!token };
}
