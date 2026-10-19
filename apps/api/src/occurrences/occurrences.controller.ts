import { Body, Controller, Delete, Get, Post, Param, ParseIntPipe, Patch, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { OccurrencesService } from "./occurrences.service.js";
import { OccurrenceCreationService } from "./occurrence-creation.service.js";
import { OccurrencePdfService } from "./occurrence-pdf.service.js";

@Controller(["api", "api/v1"])
export class OccurrencesController {
  constructor(private readonly occurrences:OccurrencesService,private readonly creation:OccurrenceCreationService,private readonly pdf:OccurrencePdfService){}
  @Post("occurrences")
  create(@Req() request:AuthenticatedRequest,@Body() input:Record<string,unknown>){return this.creation.create(request.user,input);}
  @Get("occurrences")
  list(@Req() request:AuthenticatedRequest){return this.occurrences.list(request.user);}
  @Get("occurrences/:id/pdf")
  async pdfFile(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number,@Res() response:Response){
    const pdf=await this.pdf.generate(request.user,id);
    response.setHeader("Content-Type","application/pdf");
    response.setHeader("Content-Disposition",`attachment; filename="ocorrencia-${String(id).padStart(4,"0")}.pdf"`);
    response.setHeader("Cache-Control","no-store");
    response.send(pdf);
  }
  @Get("occurrences/:id/attachments/:attachmentId")
  async download(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number,
    @Param("attachmentId",ParseIntPipe) attachmentId:number,@Res() response:Response){
    const file=await this.occurrences.attachment(request.user,id,attachmentId);
    const safeName=file.filename.replace(/[\r\n"\\]/g,"_");
    response.setHeader("Content-Type",file.mimetype||"application/octet-stream");
    response.setHeader("Content-Disposition",'attachment; filename="'+safeName+'"');
    response.send(file.content);
  }
  @Roles("admin")
  @Patch("admin/occurrences/:id")
  update(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number,
    @Body() input:Record<string,unknown>){return this.occurrences.update(request.user,id,input);}
  @Roles("admin")
  @Delete("admin/occurrences/:id")
  delete(@Req() request:AuthenticatedRequest,@Param("id",ParseIntPipe) id:number){
    return this.occurrences.delete(request.user,id);
  }
}
