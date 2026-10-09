"use client";
import type {ModuleId} from "../lib/navigation";
import {useAuthenticatedUser} from "./app-shell";
import ModuleRenderer from "./module-renderer";
export default function ModulePage({module}:{module:ModuleId}){const user=useAuthenticatedUser();return <ModuleRenderer module={module} user={user}/>}
