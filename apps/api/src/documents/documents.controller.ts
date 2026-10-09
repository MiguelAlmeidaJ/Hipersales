import { Controller, Get, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { Roles } from "../common/decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { DocumentsService } from "./documents.service.js";

function send(response: Response, filename: string, content: Buffer): void {
  response.set({ "content-type": "application/pdf", "content-disposition": `inline; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
    "cache-control": "private, no-store", "content-length": String(content.length) });
  response.end(content);
}

@Controller("api")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get("proposals/:id/pdf")
  async proposal(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Res() response: Response) {
    send(response, `pedido-${id}.pdf`, await this.documents.proposal(request.user, id));
  }

  @Roles("admin")
  @Get("admin/occurrences/:id/pdf")
  async occurrence(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Res() response: Response) {
    send(response, `ocorrencia-${id}.pdf`, await this.documents.occurrence(request.user, id));
  }

  @Roles("admin")
  @Get("admin/customers/:id/performance/pdf")
  async customer(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number, @Res() response: Response) {
    const result = await this.documents.customerPerformance(request.user, id);
    send(response, `desempenho-${result.name}.pdf`, result.buffer);
  }

  @Roles("admin")
  @Get("admin/reports/pdf")
  async report(@Req() request: AuthenticatedRequest, @Query() query: Record<string, string | undefined>, @Res() response: Response) {
    send(response, `relatorio-${query.type || "vendas"}.pdf`, await this.documents.report(request.user, query));
  }
}
