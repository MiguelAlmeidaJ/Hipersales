import type { PublicUser } from "@hipersales/contracts";
import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user: PublicUser;
  sessionToken: string;
}
