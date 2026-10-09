import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { updateSettingsRequestSchema, type UpdateSettingsRequest } from "@hipersales/contracts";
import { Roles } from "../common/decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { SettingsService } from "./settings.service.js";
import { IntegrationsService } from "./integrations.service.js";

@Roles("admin")
@Controller("api/admin/settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService, private readonly integrations: IntegrationsService) {}

  @Get()
  async get(@Req() request: AuthenticatedRequest) {
    await this.integrations.refresh(request.user);
    return this.settings.get(request.user);
  }

  @HttpCode(200)
  @Post()
  save(@Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(updateSettingsRequestSchema)) input: UpdateSettingsRequest) {
    return this.settings.save(request.user, input);
  }

  @HttpCode(200)
  @Post("smtp/test")
  testSmtp(@Req() request: AuthenticatedRequest, @Body() input: unknown) {
    return this.integrations.testSmtp(request.user, input);
  }

  @HttpCode(200)
  @Post("whatsapp/connect")
  connect(@Req() request: AuthenticatedRequest, @Body() input: unknown) {
    return this.integrations.connect(request.user, input);
  }

  @HttpCode(200)
  @Post("whatsapp/disconnect")
  disconnect(@Req() request: AuthenticatedRequest) { return this.integrations.disconnect(request.user); }
}
