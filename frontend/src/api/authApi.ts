import { ApiClient } from "@/core/ApiClient";
import type { AuthSessionDTO, Credentials, ProviderInfo } from "@/types";

export const authApi = {
  listProviders: () => ApiClient.get<{ providers: ProviderInfo[] }>("/auth/providers"),
  loginGoogle: () => ApiClient.get<{ authorizeUrl: string; state: string }>("/auth/google/login"),
  loginGithub: () => ApiClient.get<{ authorizeUrl: string; state: string }>("/auth/github/login"),
  loginGuest: () => ApiClient.post<AuthSessionDTO>("/auth/guest"),
  register: (credentials: Credentials) => ApiClient.post<AuthSessionDTO>("/auth/register", credentials),
  login: (credentials: Credentials) => ApiClient.post<AuthSessionDTO>("/auth/login", credentials),
};
