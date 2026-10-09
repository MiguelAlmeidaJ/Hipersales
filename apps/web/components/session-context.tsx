"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "../lib/api";

export const SessionContext = createContext<SessionUser | null>(null);

export function useAuthenticatedUser(): SessionUser {
  const user = useContext(SessionContext);

  if (!user) {
    throw new Error("Authenticated session is required");
  }

  return user;
}
