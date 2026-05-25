import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { unauthorized } from '../api.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      const msg =
        info?.name === 'TokenExpiredError'
          ? 'access_token_expired'
          : '未登录或凭证无效';
      throw unauthorized(msg);
    }
    return user;
  }
}
