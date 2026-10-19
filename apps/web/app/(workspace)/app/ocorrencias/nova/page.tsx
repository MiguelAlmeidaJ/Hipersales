"use client";
import { useAuthenticatedUser } from "@/components/auth/session-context";
import OccurrenceEditor from "@/components/occurrences/occurrence-editor";
export default function Page(){const user=useAuthenticatedUser();return <OccurrenceEditor user={user} standalone/>;}
