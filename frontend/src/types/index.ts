import type { ResourceKey } from "@/config/gameConfig";

export interface UserDTO {
  id: string;
  username: string | null;
  email: string | null;
  oauthProvider: string | null;
  avatarUrl: string | null;
  hasUsername: boolean;
  createdAt: string | null;
}

export interface AuthSessionDTO {
  token: string;
  user: UserDTO;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface ProviderInfo {
  id: "google" | "github" | "guest";
  label: string;
  configured: boolean;
}

export interface NasaMissionBriefing {
  stories: {
    kind: string;
    title: string | null;
    summary: string | null;
    date: string | null;
    imageUrl: string | null;
    images?: string[];
    sourceUrl: string | null;
  }[];
  apod: {
    title: string | null;
    explanation: string | null;
    date: string | null;
    mediaType: string | null;
    url: string | null;
    imageUrl: string | null;
    copyright: string | null;
  };
  marsPhotos: {
    id: number;
    imgSrc: string;
    earthDate: string | null;
    camera: string | null;
    rover: string | null;
  }[];
  source: string;
}

export interface MissionDTO {
  id: number;
  slug: string;
  order: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  lockedByDefault: boolean;
  status: "locked" | "unlocked" | "in_progress" | "completed";
  progressPercent: number;
}

export interface MissionProgressDTO {
  missionId: number;
  missionSlug: string | null;
  status: MissionDTO["status"];
  progressPercent: number;
  state: MissionSaveState | Record<string, never>;
  report: MissionReport | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

/** Opaque-to-the-backend gameplay snapshot used for autosave/resume. */
export interface MissionSaveState {
  tick: number;
  resources: Record<ResourceKey, number>;
  resolvedDecisionIds: string[];
  log: string[];
  decisionsMade?: number;
  samplesCollected?: { sampleKey: string; label: string; type: string; quality: number }[];
  mission01?: {
    objectives: string[];
    records: string[];
    engineering: import("@/state/Mission01Engineering").EngineeringProfile;
    checkpoint: string;
    analyzed: string[];
    flightResult: import("@/state/Mission01Launch").FlightResult | null;
  };
}

export interface MissionReport {
  ticksSurvived: number;
  decisionsMade: number;
  samplesCollected: number;
  finalResources: Record<ResourceKey, number>;
  outcome: "success" | "partial" | "failure";
  summary: string;
  engineeringConfiguration?: import("@/state/Mission01Engineering").EngineeringProfile;
  testingDecision?: string | null;
  launchDecision?: string | null;
  flightResult?: import("@/state/Mission01Launch").FlightResult;
  dataRecovered?: number;
  optionalObjectives?: string[];
  historicalRecords?: string[];
}

export interface InventoryItemDTO {
  itemKey: string;
  label: string;
  quantity: number;
  unit: string;
  updatedAt: string | null;
}

export interface SampleDTO {
  id: number;
  missionId: number | null;
  sampleKey: string;
  label: string;
  type: string;
  quality: number;
  collectedAt: string | null;
}

export interface StatisticDTO {
  missionId: number | null;
  metricKey: string;
  metricLabel: string;
  value: number;
  recordedAt: string | null;
}
