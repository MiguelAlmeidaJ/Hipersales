import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import {
  createUserRequestSchema,
  updateUserRequestSchema,
  type CreateUserRequest,
  type UpdateUserRequest,
} from "@hipersales/contracts";
import { Roles } from "../common/decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe.js";
import { UsersService } from "./users.service.js";

@Roles("admin")
@Controller("api/admin/users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.users.list(request.user);
  }

  @HttpCode(200)
  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createUserRequestSchema)) input: CreateUserRequest,
  ) {
    return this.users.create(request.user, input);
  }

  @HttpCode(200)
  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateUserRequestSchema)) input: UpdateUserRequest,
  ) {
    return this.users.update(request.user, id, input, request.sessionToken);
  }
}
