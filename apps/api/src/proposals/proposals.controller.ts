import { Controller, Get, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ProposalsService } from "./proposals.service.js";

@Controller("api")
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get("proposals")
  list(@Req() request: AuthenticatedRequest) {
    return this.proposals.list(request.user);
  }
}
