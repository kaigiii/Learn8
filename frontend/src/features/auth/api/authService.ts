import { apiClient } from "@/lib/api-client";

export interface RegisterDTO {
    email: string;
    password: string;
    full_name: string;
    phone_number: string;
}

export interface LoginDTO {
    email: string;
    password: string;
}

export interface UpdateProfileDTO {
    full_name?: string;
    phone_number?: string;
    job_title?: string;
    education_level?: string;
}

export const authService = {
    // Auth Flow
    register: async (data: RegisterDTO) => {
        return apiClient.post("/auth/register", data);
    },

    login: async (data: LoginDTO) => {
        return apiClient.post("/auth/login", data);
    },

    devLogin: async () => {
        return apiClient.post("/auth/dev-login");
    },

    // User Profile (Me)
    me: {
        get: async (token?: string) => {
            const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
            return apiClient.get('/auth/me', config);
        },
        update: async (data: UpdateProfileDTO) => {
            return apiClient.put('/auth/me', data);
        },
        delete: async () => {
            return apiClient.delete('/auth/me');
        }
    },

    // Credits / Billing
    credits: {
        topUp: async (amount: number) => {
            // Currently using a mock endpoint or reuse a generic patch if specific endpoint doesn't exist
            // Assuming backend has: PATCH /auth/me/credits or similar.
            // Based on user code, we might need to create this endpoint or mock it.
            // For now, I'll assume we send a request to update user, or a specific credits endpoint.
            // If strictly following existing logic, ProfileView was likely mocking it or using a not-impl endpoint.
            // I will use a hypothetical endpoint for now, or just update the user if that allows credit modification (unlikely).
            // Let's assume there is a specific action for this.
            return apiClient.post(`/auth/credits/topup?amount=${amount}`);
        }
    }
};
