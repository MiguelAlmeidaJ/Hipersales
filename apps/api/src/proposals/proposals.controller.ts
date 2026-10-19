import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, Res } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ProposalsService } from "./proposals.service.js";
import { ProposalCreationService } from "./proposal-creation.service.js";
import { ProposalUpdateService } from "./proposal-update.service.js";
import { ProposalDeletionService } from "./proposal-deletion.service.js";
import type { Response } from "express";
import { ProposalInvoiceService } from "./proposal-invoice.service.js";
import { Roles } from "../common/decorators/roles.decorator.js";

@Controller(["api", "api/v1"])
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService, private readonly creation: ProposalCreationService, private readonly updates:ProposalUpdateService, private readonly deletion:ProposalDeletionService,private readonly invoices:ProposalInvoiceService) {}

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

  @Roles("admin")
  @Delete("admin/proposals/:id")
  delete(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.deletion.delete(request.user, id);
  }

  @Roles("admin")
  @Post("admin/proposals/:id/invoice-pdf")
  uploadInvoice(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number,@Body() input:Record<string,unknown>){
    return this.invoices.upload(request.user,id,input);
  }
  @Get("proposals/:id/invoice-pdf")
  async invoicePdf(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number,@Res() response:Response){
    const file=await this.invoices.download(request.user,id);
    response.setHeader("Content-Type","application/pdf");
    response.setHeader("Content-Disposition",`attachment; filename="${file.filename.replace(/[\\\r\n"]/g,"_")}"`);
    response.setHeader("Cache-Control","no-store");
    response.send(file.content);
  }
  @Get("proposals")
  list(@Req() request: AuthenticatedRequest) {
    return this.proposals.list(request.user);
  }
}
