import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const response = ctx.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        if (response.statusCode === 204) {
          return data; // no body for 204
        }
        return { success: true, data, errorCode: null, message: null, details: null };
      }),
    );
  }
}
