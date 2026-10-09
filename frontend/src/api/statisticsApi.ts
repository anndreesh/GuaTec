import { ApiClient } from "@/core/ApiClient";
import type { StatisticDTO } from "@/types";

export const statisticsApi = {
  list: () => ApiClient.get<{ statistics: StatisticDTO[] }>("/statistics"),
  record: (payload: { missionSlug: string; metricKey: string; metricLabel: string; value: number }) =>
    ApiClient.post<StatisticDTO>("/statistics", payload),
  summary: (missionSlug: string) =>
    ApiClient.get<{ missionSlug: string; metrics: { metricKey: string; metricLabel: string; total: number }[] }>(
      `/statistics/summary/${missionSlug}`,
    ),
};
