import { ApiClient } from "@/core/ApiClient";
import type { AuthSessionDTO, Credentials, ProviderInfo } from "@/types";

export const authApi = {
  listProviders: () => ApiClient.get<{ providers: ProviderInfo[] }>("/auth/providers"),
  loginGuest: () => ApiClient.post<AuthSessionDTO>("/auth/guest"),
  register: (credentials: Credentials) => ApiClient.post<AuthSessionDTO>("/auth/register", credentials),
  login: (credentials: Credentials) => ApiClient.post<AuthSessionDTO>("/auth/login", credentials),
};
