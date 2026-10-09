import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Erro interno do servidor.";

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === "string") message = body;
      else if (body && typeof body === "object" && "message" in body) {
        const detail = body.message;
        message = Array.isArray(detail) ? String(detail[0] ?? message) : String(detail);
      }
    } else {
      console.error(exception);
    }

    response.status(status).json({ error: message });
  }
}
