import { ApiClient } from "@/core/ApiClient";
import type { SampleDTO } from "@/types";

export const samplesApi = {
  list: () => ApiClient.get<{ samples: SampleDTO[] }>("/samples"),
  collect: (payload: { missionSlug: string; sampleKey: string; label: string; type: string; quality: number }) =>
    ApiClient.post<SampleDTO>("/samples", payload),
};
