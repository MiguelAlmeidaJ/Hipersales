import { Module } from "@nestjs/common";
import { OccurrenceCreationService } from "./occurrence-creation.service.js";
import { OccurrencesController } from "./occurrences.controller.js";
import { OccurrencesService } from "./occurrences.service.js";
@Module({controllers:[OccurrencesController],providers:[OccurrencesService,OccurrenceCreationService]})
export class OccurrencesModule {}
