import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiException } from '../api.exception';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errBase = { success: false, data: null };

    if (exception instanceof ApiException) {
      response.status(exception.getStatus()).json({
        ...errBase,
        errorCode: exception.errorCode,
        message: exception.message,
        details: exception.details ?? null,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // class-validator errors come as 400 with { message: string[] }
      if (status === 400 && typeof body === 'object' && Array.isArray((body as any).message)) {
        const messages: string[] = (body as any).message;
        const details = messages.map((m) => {
          const parts = m.split(' ');
          return { field: parts[0] ?? 'unknown', message: m };
        });
        response.status(422).json({
          ...errBase,
          errorCode: 'VALIDATION_ERROR',
          message: messages[0] ?? 'Validation failed',
          details,
        });
        return;
      }
      response.status(status).json({
        ...errBase,
        errorCode: 'BAD_REQUEST',
        message: typeof body === 'string' ? body : exception.message,
        details: null,
      });
      return;
    }

    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      ...errBase,
      errorCode: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      details: null,
    });
  }
}
