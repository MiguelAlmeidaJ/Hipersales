import { Body, Controller, DefaultValuePipe, Get, Headers, HttpCode, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { IntegrationsService } from "./integrations.service.js";

@Public()
@Controller("api")
export class InternalIntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  private authorize(header: string | undefined, query: string | undefined): void {
    this.integrations.verifyInternalToken(String(header || query || ""));
  }

  @Get("internal/whatsapp/settings")
  settings(@Headers("x-hipersales-token") header?: string, @Query("token") token?: string,
    @Query("tenant_id", new DefaultValuePipe(1), ParseIntPipe) tenantId = 1) {
    this.authorize(header, token);
    return this.integrations.internalSettings(tenantId);
  }

  @HttpCode(200)
  @Post("internal/whatsapp/state")
  state(@Headers("x-hipersales-token") header: string | undefined, @Query("token") token: string | undefined,
    @Query("tenant_id", new DefaultValuePipe(1), ParseIntPipe) tenantId: number, @Body() input: Record<string, unknown>) {
    this.authorize(header, token);
    return this.integrations.updateInternalState(tenantId, input);
  }

  @Get("internal/whatsapp/pending")
  pending(@Headers("x-hipersales-token") header?: string, @Query("token") token?: string) {
    this.authorize(header, token); return this.integrations.pendingMessages();
  }

  @HttpCode(200)
  @Post("internal/whatsapp/outbox/:id")
  outbox(@Headers("x-hipersales-token") header: string | undefined, @Query("token") token: string | undefined,
    @Param("id", ParseIntPipe) id: number, @Body() input: Record<string, unknown>) {
    this.authorize(header, token); return this.integrations.updateOutbox(id, input);
  }

  @HttpCode(200)
  @Post("evolution/webhook")
  webhook(@Headers("x-hipersales-token") header: string | undefined, @Query("token") token: string | undefined,
    @Body() input: Record<string, unknown>) {
    this.authorize(header, token); return this.integrations.webhook(input);
  }
}
