import { ApiClient } from "@/core/ApiClient";
import type { MissionDTO } from "@/types";

export const missionsApi = {
  list: () => ApiClient.get<{ missions: MissionDTO[] }>("/missions"),
};
