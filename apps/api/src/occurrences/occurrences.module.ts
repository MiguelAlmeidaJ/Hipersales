import { Module } from "@nestjs/common";
import { OccurrencesController } from "./occurrences.controller.js";
import { OccurrencesService } from "./occurrences.service.js";
@Module({controllers:[OccurrencesController],providers:[OccurrencesService]})
export class OccurrencesModule {}
