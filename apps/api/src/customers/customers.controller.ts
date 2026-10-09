import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { CustomersService } from "./customers.service.js";
import { CnpjLookupService } from "./cnpj-lookup.service.js";
import { CustomersWriteService, type CustomerInput } from "./customers-write.service.js";

@Controller("api")
export class CustomersController {
  constructor(private readonly customers: CustomersService, private readonly writes: CustomersWriteService, private readonly cnpjLookup: CnpjLookupService) {}

  @Get("integrations/cnpj")
  lookupCnpj(
    @Req() request: AuthenticatedRequest,
    @Query("cnpj") cnpj = "",
    @Query("exclude_customer_id") excludeId = "",
  ) {
    return this.cnpjLookup.lookup(request.user.tenant_id, cnpj,
      /^\d+$/.test(excludeId) ? Number(excludeId) : undefined);
  }

  @Get("customers")
  list(@Req() request: AuthenticatedRequest, @Query("q") term = "") {
    return this.customers.list(request.user, term);
  }

  @Roles("admin")
  @Get("admin/customers")
  adminList(
    @Req() request: AuthenticatedRequest,
    @Query("q") term = "",
    @Query("active") active = "all",
  ) {
    return this.customers.adminList(request.user, term, active);
  }
  @Roles("admin")
  @Post("admin/customers")
  create(@Req() request: AuthenticatedRequest, @Body() input: CustomerInput) {
    return this.writes.create(request.user, input);
  }

  @Roles("admin")
  @Patch("admin/customers/:id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: CustomerInput,
  ) {
    return this.writes.update(request.user, id, input);
  }

  @Roles("admin")
  @Delete("admin/customers/:id")
  remove(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.writes.remove(request.user, id);
  }

}
