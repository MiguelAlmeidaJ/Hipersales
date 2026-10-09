import { Module } from "@nestjs/common";
import { GoalsModule } from "../goals/goals.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { ScheduledJobsService } from "./scheduled-jobs.service.js";
@Module({imports:[GoalsModule,SettingsModule],providers:[ScheduledJobsService]})
export class JobsModule {}
