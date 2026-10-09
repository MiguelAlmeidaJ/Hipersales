import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { CustomersService } from "./customers.service.js";

@Controller("api")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

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
}
