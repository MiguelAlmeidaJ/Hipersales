import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ProposalsService } from "./proposals.service.js";
import { ProposalCreationService } from "./proposal-creation.service.js";
import { ProposalUpdateService } from "./proposal-update.service.js";
import { Roles } from "../common/decorators/roles.decorator.js";

@Controller("api")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService, private readonly creation: ProposalCreationService, private readonly updates:ProposalUpdateService) {}

  @Post("proposals")
  create(@Req() request: AuthenticatedRequest, @Body() data: Parameters<ProposalCreationService["create"]>[1]) {
    return this.creation.create(request.user, data);
  }

  @Roles("admin")
  @Patch("admin/proposals/:id")
  update(@Req() request: AuthenticatedRequest, @Param("id",ParseIntPipe) id:number,
    @Body() input:Record<string,unknown>) {
    return this.updates.update(request.user,id,input);
  }

  @Get("proposals")
  list(@Req() request: AuthenticatedRequest) {
    return this.proposals.list(request.user);
  }
}
