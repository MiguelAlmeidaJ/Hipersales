import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/http/authenticated-request.js";
import { NotificationsService } from "./notifications.service.js";

@Controller(["api", "api/v1"])
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("notifications")
  list(@Req() request: AuthenticatedRequest) { return this.notifications.list(request.user); }

  @Get("notifications/unread-count")
  unread(@Req() request: AuthenticatedRequest) { return this.notifications.unreadCount(request.user); }

  @Patch("notifications/:id/read")
  read(@Req() request: AuthenticatedRequest, @Param("id",ParseIntPipe) id:number) {
    return this.notifications.markRead(request.user,id);
  }

  @HttpCode(200)
  @Post("notifications/read-all")
  readAll(@Req() request: AuthenticatedRequest) { return this.notifications.markAllRead(request.user); }

  @Post("mobile/push-token")
  register(@Req() request: AuthenticatedRequest, @Body() input:Record<string,unknown>) {
    return this.notifications.registerToken(request.user,input);
  }

  @Delete("mobile/push-token")
  unregister(@Req() request: AuthenticatedRequest, @Body() input:Record<string,unknown>) {
    return this.notifications.unregisterToken(request.user,input.token);
  }
}
