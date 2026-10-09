import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { CatalogTransferService } from "./catalog-transfer.service.js";

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogTransferService],
})
export class CatalogModule {}
