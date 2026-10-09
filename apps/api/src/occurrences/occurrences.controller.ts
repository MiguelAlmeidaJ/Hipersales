import { Body, Controller, Delete, Get, Post, Param, ParseIntPipe, Patch, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { OccurrencesService } from "./occurrences.service.js";
import { OccurrenceCreationService } from "./occurrence-creation.service.js";

@Controller("api")
export class OccurrencesController {
  constructor(private readonly occurrences:OccurrencesService,private readonly creation:OccurrenceCreationService){}
  @Post("occurrences")
  create(@Req() request:AuthenticatedRequest,@Body() input:Record<string,unknown>){return this.creation.create(request.user,input);}
  @Get("occurrences")
  list(@Req() request:AuthenticatedRequest){return this.occurrences.list(request.user);}
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
