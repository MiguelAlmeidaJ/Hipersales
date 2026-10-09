import { Module } from "@nestjs/common";
import { ProposalsController } from "./proposals.controller.js";
import { ProposalsService } from "./proposals.service.js";
import { ProposalCreationService } from "./proposal-creation.service.js";

@Module({
  controllers: [ProposalsController],
  providers: [ProposalsService, ProposalCreationService],
})
export class ProposalsModule {}
