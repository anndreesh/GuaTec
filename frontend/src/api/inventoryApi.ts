import { ApiClient } from "@/core/ApiClient";
import type { InventoryItemDTO } from "@/types";

export const inventoryApi = {
  list: () => ApiClient.get<{ items: InventoryItemDTO[] }>("/inventory"),
  sync: (items: InventoryItemDTO[]) => ApiClient.put<{ items: InventoryItemDTO[] }>("/inventory", { items }),
};
