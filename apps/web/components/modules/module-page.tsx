"use client";
import { useAuthenticatedUser } from "@/components/auth/session-context";
import type { ModuleId } from "@/lib/navigation";
import ModuleRenderer from "./module-renderer";
export default function ModulePage({ module }: { module: ModuleId }) {
  const user = useAuthenticatedUser();
  return <ModuleRenderer module={module} user={user} />;
}
