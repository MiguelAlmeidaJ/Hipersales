import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { CatalogService } from "./catalog.service.js";

@Controller("api")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("companies")
  companies(@Req() request: AuthenticatedRequest) {
    return this.catalog.companies(request.user);
  }

  @Get("products")
  products(
    @Req() request: AuthenticatedRequest,
    @Query("company_id") companyId = "0",
    @Query("q") search = "",
  ) {
    return this.catalog.products(request.user, Number(companyId || 0), search);
  }

  @Roles("admin")
  @Get("admin/companies")
  adminCompanies(
    @Req() request: AuthenticatedRequest,
    @Query("q") search = "",
    @Query("active") active = "all",
  ) {
    return this.catalog.adminCompanies(request.user, search, active);
  }

  @Roles("admin")
  @Get("admin/products")
  adminProducts(
    @Req() request: AuthenticatedRequest,
    @Query("company_id") companyId = "",
    @Query("q") search = "",
    @Query("active") active = "all",
  ) {
    return this.catalog.adminProducts(request.user, companyId, search, active);
  }
}
