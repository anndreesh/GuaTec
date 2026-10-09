import { ApiClient } from "@/core/ApiClient";
import type { MissionProgressDTO, MissionReport, MissionSaveState } from "@/types";

export const progressApi = {
  get: (missionSlug: string) => ApiClient.get<MissionProgressDTO>(`/progress/${missionSlug}`),
  autosave: (missionSlug: string, state: MissionSaveState, progressPercent: number) =>
    ApiClient.put<MissionProgressDTO>(`/progress/${missionSlug}`, { state, progressPercent }),
  complete: (missionSlug: string, report: MissionReport) =>
    ApiClient.post<{ progress: MissionProgressDTO; unlockedNext: string | null }>(
      `/progress/${missionSlug}/complete`,
      { report },
    ),
  replay: (missionSlug: string) =>
    ApiClient.post<MissionProgressDTO>(`/progress/${missionSlug}/replay`),
};
