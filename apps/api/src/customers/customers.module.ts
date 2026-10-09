import { Module } from "@nestjs/common";
import { CustomersController } from "./customers.controller.js";
import { CustomersService } from "./customers.service.js";
import { CustomersWriteService } from "./customers-write.service.js";
import { CnpjLookupService } from "./cnpj-lookup.service.js";

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomersWriteService, CnpjLookupService],
})
export class CustomersModule {}
