import { apiClient } from "@/lib/api-client";

export const authService = {
    // Auth Flow
    register: async (data: { email: string; password: string; full_name?: string; phone_number?: string }) => {
        return apiClient.post("/auth/register", data);
    },

    login: async (data: any) => {
        // Assuming login is handled via different flow or this is a placeholder
        // If you have a login endpoint: return apiClient.post("/auth/login", data);
        // Currently standard next-auth integration might not use this, but good to have.
        return apiClient.post("/auth/login", data);
    },

    // User Profile
    me: {
        get: async () => {
            return apiClient.get("/auth/me");
        },
        update: async (data: { full_name?: string; phone_number?: string; job_title?: string; education_level?: string }) => {
            return apiClient.put("/auth/me", data);
        },
        delete: async () => {
            return apiClient.delete("/auth/me");
        }
    },

    // Credits
    credits: {
        topUp: async (amount: number) => {
            return apiClient.post(`/auth/credits/topup?amount=${amount}`);
        }
    }
};
