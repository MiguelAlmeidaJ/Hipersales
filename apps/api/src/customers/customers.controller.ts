import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { CustomersService } from "./customers.service.js";
import { CnpjLookupService } from "./cnpj-lookup.service.js";
import { CustomerRegistrationService } from "./customer-registration.service.js";
import { RegistrationRequestsService } from "./registration-requests.service.js";
import { RegistrationReviewService } from "./registration-review.service.js";
import { RegistrationSubmissionService, type RegistrationInput } from "./registration-submission.service.js";
import { CustomersWriteService, type CustomerInput } from "./customers-write.service.js";

@Controller("api")
export class CustomersController {
  constructor(private readonly customers: CustomersService, private readonly writes: CustomersWriteService, private readonly cnpjLookup: CnpjLookupService, private readonly registration: CustomerRegistrationService, private readonly requests: RegistrationRequestsService, private readonly submissions: RegistrationSubmissionService, private readonly reviews: RegistrationReviewService) {}

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

  @Post("customer-requests")
  submitRequest(@Req() request: AuthenticatedRequest, @Body() input: RegistrationInput) {
    return this.submissions.submit(request.user, input);
  }

  @Roles("admin")
  @Patch("admin/requests/:id")
  reviewRequest(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number,
    @Body() input: Record<string, unknown>) {
    return this.reviews.review(request.user,id,input);
  }

  @Roles("admin")
  @Get("admin/requests")
  adminRequests(@Req() request: AuthenticatedRequest) {
    return this.requests.list(request.user);
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
    return this.registration.create(request.user, input);
  }

  @Roles("admin")
  @Patch("admin/customers/:id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: CustomerInput,
  ) {
    return this.registration.update(request.user, id, input);
  }

  @Roles("admin")
  @Delete("admin/customers/:id")
  remove(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number) {
    return this.writes.remove(request.user, id);
  }

}
