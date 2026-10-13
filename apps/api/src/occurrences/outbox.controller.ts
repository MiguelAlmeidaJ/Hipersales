import { Controller,Get,Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { DatabaseRepository } from "../database/database.repository.js";
@Controller("api/admin")
export class OutboxController {
 constructor(private readonly database:DatabaseRepository){}
 @Roles("admin")
 @Get("outbox")
 async list(@Req() request:AuthenticatedRequest){
  return {outbox:await this.database.db.prepare("SELECT TOP (20) * FROM email_outbox WHERE tenant_id=? ORDER BY id DESC").all(request.user.tenant_id)};
 }
}
