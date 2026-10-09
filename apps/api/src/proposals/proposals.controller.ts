import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ProposalsService } from "./proposals.service.js";
import { ProposalCreationService } from "./proposal-creation.service.js";

@Controller("api")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService, private readonly creation: ProposalCreationService) {}

  @Post("proposals")
  create(@Req() request: AuthenticatedRequest, @Body() data: Parameters<ProposalCreationService["create"]>[1]) {
    return this.creation.create(request.user, data);
  }

  @Get("proposals")
  list(@Req() request: AuthenticatedRequest) {
    return this.proposals.list(request.user);
  }
}
