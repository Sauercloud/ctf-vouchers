import { randomBytes } from "node:crypto";
import { config } from "@/lib/config";

export const newToken = () => randomBytes(16).toString("hex");

export const replicaAddress = (token: string) => `v-${token}@${config.mailDomain}`;
export const confirmAddress = (token: string) => `c-${token}@${config.mailDomain}`;
