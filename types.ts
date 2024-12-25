import { Request } from "express";

export interface CustomRequest extends Request {
  userId?: string;
}

type ContentType = {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: "high" | "low" };
};

export type MessageType = {
  role: RoleEnum;
  content: ContentType[] | string;
  name?: string;
};

export type RunType = {
  isMini: boolean;
  content: ContentType[];
  model?: string;
  responseFormat?: string | { type: string };
  callback?: () => void;
};

export enum RoleEnum {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
}

export type CoordinateType = { x: number; y: number };

export type EyeDataType = {
  leftEyeCenter: CoordinateType | null;
  leftEyeRadius: number | null;
  rightEyeCenter: CoordinateType | null;
  rightEyeRadius: number | null;
};

export type FaceDataType = {
  faceCenter: CoordinateType | null;
  faceRadius: number | null;
};

export type TranslatedPoint = {
  x: number;
  y: number;
};

export enum CategoryNameEnum {
  TASKS = "tasks",
  PROGRESSSCAN = "progressScan",
  FOODSCAN = "foodScan",
  STYLESCAN = "styleScan",
  PRODUCTS = "products",
  ADVISOR = "advisor",
  ABOUT = "about",
  PROOF = "proof",
  OTHER = "other",
}
