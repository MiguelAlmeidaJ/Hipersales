import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import {
  assignmentRequestSchema,
  legacyCustomerAssignmentRequestSchema,
  type AssignmentRequest,
  type LegacyCustomerAssignmentRequest,
} from "@hipersales/contracts";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { Roles } from "../common/decorators/roles.decorator.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { AssignmentsService } from "./assignments.service.js";

@Roles("admin")
@Controller("api/admin")
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get("users/:id/customers")
  customers(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number,
    @Query("q") search = "", @Query("active") active = "all") {
    return this.assignments.list(request.user, "customers", id, search, active);
  }

  @Get("users/:id/companies")
  companies(@Req() request: AuthenticatedRequest, @Param("id", ParseIntPipe) id: number,
    @Query("q") search = "", @Query("active") active = "all") {
    return this.assignments.list(request.user, "companies", id, search, active);
  }

  @Patch("customer-assignments")
  assignCustomer(@Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(assignmentRequestSchema)) input: AssignmentRequest) {
    return this.assignments.set(request.user, "customers", input);
  }

  @Patch("company-assignments")
  assignCompany(@Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(assignmentRequestSchema)) input: AssignmentRequest) {
    return this.assignments.set(request.user, "companies", input);
  }

  @HttpCode(200)
  @Post("assign-customer")
  assignCustomerLegacy(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(legacyCustomerAssignmentRequestSchema)) input: LegacyCustomerAssignmentRequest,
  ) {
    return this.assignments.set(request.user, "customers", { ...input, assigned: true });
  }
}
