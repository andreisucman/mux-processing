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
