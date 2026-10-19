import { Module } from "@nestjs/common";
import { CompanyPdfService } from "./company-pdf.service.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";
import { CatalogTransferService } from "./catalog-transfer.service.js";

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogTransferService, CompanyPdfService],
})
export class CatalogModule {}
