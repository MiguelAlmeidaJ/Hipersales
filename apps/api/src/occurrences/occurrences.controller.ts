import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { OccurrencesService } from "./occurrences.service.js";

@Controller("api")
export class OccurrencesController {
  constructor(private readonly occurrences:OccurrencesService){}
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
