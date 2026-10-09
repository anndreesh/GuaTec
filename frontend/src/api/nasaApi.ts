import { ApiClient } from "@/core/ApiClient";
import type { NasaMissionBriefing } from "@/types";

export const nasaApi = {
  missionBriefing: () => ApiClient.get<NasaMissionBriefing>("/nasa/mission-briefing"),
};
