import { Module } from "@nestjs/common";
import { OutboxController } from "./outbox.controller.js";
import { OccurrenceCreationService } from "./occurrence-creation.service.js";
import { OccurrencesController } from "./occurrences.controller.js";
import { OccurrencesService } from "./occurrences.service.js";
@Module({controllers:[OccurrencesController,OutboxController],providers:[OccurrencesService,OccurrenceCreationService]})
export class OccurrencesModule {}
