import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  conflict,
  rateLimited,
  unauthorized,
} from '../common/api.exception';
import { AppConfig } from '../config/configuration';
import { Capsule } from '../entities/capsule.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { ALLOWED_AVATAR_IDS } from '../health/avatar.service';
import { validationError } from '../common/api.exception';

export interface UserOut {
  id: string;
  email: string;
  nickname: string;
  avatarId: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: UserOut;
}

// Simple in-memory rate limiter: email → timestamps of failures within last 60s
const loginFailures = new Map<string, number[]>();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly tokenRepo: Repository<RefreshToken>,
    @InjectRepository(Capsule)
    private readonly capsuleRepo: Repository<Capsule>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  private hashPassword(plain: string): string {
    const rounds = this.config.get('bcryptRounds', { infer: true }) ?? 12;
    return bcrypt.hashSync(plain, rounds);
  }

  private verifyPassword(plain: string, hashed: string): boolean {
    try {
      return bcrypt.compareSync(plain, hashed);
    } catch {
      return false;
    }
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private checkRateLimit(email: string): void {
    const limit = this.config.get('loginRateLimitPerMinute', { infer: true }) ?? 10;
    const now = Date.now();
    const failures = (loginFailures.get(email) ?? []).filter((t) => now - t < 60_000);
    loginFailures.set(email, failures);
    if (failures.length >= limit) throw rateLimited();
  }

  private recordFailure(email: string): void {
    const failures = loginFailures.get(email) ?? [];
    failures.push(Date.now());
    loginFailures.set(email, failures);
  }

  private toUserOut(u: User): UserOut {
    return { id: u.id, email: u.email, nickname: u.nickname, avatarId: u.avatarId, createdAt: u.createdAt };
  }

  private issueTokenPair(user: User, familyId?: string): Omit<AuthTokens, 'user'> & { tokenRow: Partial<RefreshToken> } {
    const accessTtl = this.config.get('accessTokenTtlSeconds', { infer: true }) ?? 900;
    const refreshTtl = this.config.get('refreshTokenTtlSeconds', { infer: true }) ?? 2592000;

    const accessToken = this.jwtService.sign(
      { sub: user.id, nickname: user.nickname, avatarId: user.avatarId },
      { expiresIn: accessTtl },
    );

    const rawRefresh = this.generateRefreshToken();
    const tokenHash = this.hashRefreshToken(rawRefresh);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + refreshTtl * 1000);

    const tokenRow: Partial<RefreshToken> = {
      id: uuidv4(),
      userId: user.id,
      tokenHash,
      familyId: familyId ?? uuidv4(),
      expiresAt,
      createdAt: now,
      revokedAt: null,
    };

    return {
      accessToken,
      refreshToken: rawRefresh,
      accessTokenExpiresIn: accessTtl,
      refreshTokenExpiresIn: refreshTtl,
      tokenRow,
    };
  }

  async register(dto: {
    email: string;
    password: string;
    nickname: string;
    avatarId: string;
  }): Promise<AuthTokens> {
    if (!ALLOWED_AVATAR_IDS.has(dto.avatarId)) {
      throw validationError('头像 ID 不存在', 'avatarId');
    }

    const emailNorm = dto.email.toLowerCase().trim();

    const existingEmail = await this.userRepo.findOne({ where: { email: emailNorm } });
    if (existingEmail) throw conflict('邮箱已被注册', 'email');

    const existingNick = await this.userRepo.findOne({ where: { nickname: dto.nickname } });
    if (existingNick) throw conflict('昵称已被使用', 'nickname');

    const now = new Date();
    const user: User = this.userRepo.create({
      id: uuidv4(),
      email: emailNorm,
      passwordHash: this.hashPassword(dto.password),
      nickname: dto.nickname,
      avatarId: dto.avatarId,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await this.userRepo.save(user);
    } catch (e: any) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('email')) throw conflict('邮箱已被注册', 'email');
      if (msg.includes('nickname')) throw conflict('昵称已被使用', 'nickname');
      throw conflict('注册冲突');
    }

    const { tokenRow, ...tokens } = this.issueTokenPair(user);
    await this.tokenRepo.save(this.tokenRepo.create(tokenRow));
    return { ...tokens, user: this.toUserOut(user) };
  }

  async login(dto: { email: string; password: string }): Promise<AuthTokens> {
    const emailNorm = dto.email.toLowerCase().trim();
    this.checkRateLimit(emailNorm);

    const user = await this.userRepo.findOne({ where: { email: emailNorm } });
    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      this.recordFailure(emailNorm);
      throw unauthorized('邮箱或密码错误');
    }

    const { tokenRow, ...tokens } = this.issueTokenPair(user);
    await this.tokenRepo.save(this.tokenRepo.create(tokenRow));
    return { ...tokens, user: this.toUserOut(user) };
  }

  async refresh(rawRefresh: string): Promise<AuthTokens> {
    // 教学注释：生产环境应用行锁（SELECT ... FOR UPDATE）或原子操作
    // （UPDATE ... WHERE revoked_at IS NULL RETURNING *）消除并发 refresh 的双发窗口。
    const tokenHash = this.hashRefreshToken(rawRefresh);
    const row = await this.tokenRepo.findOne({ where: { tokenHash } });
    if (!row) throw unauthorized('refresh token 无效');

    const now = new Date();
    if (row.expiresAt <= now) throw unauthorized('refresh token 已过期');

    if (row.revokedAt !== null) {
      // Reuse detected — revoke entire family
      await this.tokenRepo
        .createQueryBuilder()
        .update()
        .set({ revokedAt: now })
        .where('family_id = :fid AND revoked_at IS NULL', { fid: row.familyId })
        .execute();
      throw unauthorized('refresh token 已失效');
    }

    const user = await this.userRepo.findOne({ where: { id: row.userId } });
    if (!user) throw unauthorized('用户不存在');

    row.revokedAt = now;
    await this.tokenRepo.save(row);

    const { tokenRow, ...tokens } = this.issueTokenPair(user, row.familyId);
    await this.tokenRepo.save(this.tokenRepo.create(tokenRow));
    return { ...tokens, user: this.toUserOut(user) };
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (!rawRefresh) return;
    const tokenHash = this.hashRefreshToken(rawRefresh);
    const row = await this.tokenRepo.findOne({ where: { tokenHash } });
    if (row && row.revokedAt === null) {
      row.revokedAt = new Date();
      await this.tokenRepo.save(row);
    }
  }

  async changePassword(
    user: User,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    if (!this.verifyPassword(dto.currentPassword, user.passwordHash)) {
      throw unauthorized('当前密码错误');
    }
    user.passwordHash = this.hashPassword(dto.newPassword);
    user.updatedAt = new Date();
    await this.userRepo.save(user);
    // Revoke all refresh tokens
    await this.tokenRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :uid AND revoked_at IS NULL', { uid: user.id })
      .execute();
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
