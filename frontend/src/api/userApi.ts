import { ApiClient } from "@/core/ApiClient";
import type { UserDTO } from "@/types";

export const userApi = {
  me: () => ApiClient.get<UserDTO>("/user/me"),
  setUsername: (username: string) => ApiClient.post<UserDTO>("/user/username", { username }),
};
