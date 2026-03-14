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
            return apiClient.post('/auth/credits/topup', null, {
                params: { amount },
            });
        },
    }
};
