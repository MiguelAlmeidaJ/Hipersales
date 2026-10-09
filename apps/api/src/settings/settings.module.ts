import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";
import { IntegrationsService } from "./integrations.service.js";
import { InternalIntegrationsController } from "./internal-integrations.controller.js";
import { OutboxProcessorService } from "./outbox-processor.service.js";

@Module({ controllers: [SettingsController, InternalIntegrationsController], providers: [SettingsService, IntegrationsService, OutboxProcessorService], exports: [SettingsService, IntegrationsService] })
export class SettingsModule {}
