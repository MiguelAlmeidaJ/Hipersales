import { Controller,Get,Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { DatabaseService } from "../database/database.service.js";
@Controller("api/admin")
export class OutboxController {
 constructor(private readonly database:DatabaseService){}
 @Roles("admin")
 @Get("outbox")
 list(@Req() request:AuthenticatedRequest){
  return {outbox:this.database.db.prepare("SELECT * FROM email_outbox WHERE tenant_id=? ORDER BY id DESC LIMIT 20").all(request.user.tenant_id)};
 }
}
