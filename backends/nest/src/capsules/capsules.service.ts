import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { badRequest, forbidden, notFound, validationError } from '../common/api.exception';
import { AppConfig } from '../config/configuration';
import { Capsule } from '../entities/capsule.entity';
import { Favorite } from '../entities/favorite.entity';
import { User } from '../entities/user.entity';

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function isOpened(openAt: Date): boolean {
  return openAt <= new Date();
}

function contentPreview(content: string, opened: boolean): string | null {
  if (!opened) return null;
  const raw = content.trim();
  return raw.length > 80 ? raw.slice(0, 80) + '…' : raw;
}

@Injectable()
export class CapsulesService {
  constructor(
    @InjectRepository(Capsule)
    private readonly capsuleRepo: Repository<Capsule>,
    @InjectRepository(Favorite)
    private readonly favoriteRepo: Repository<Favorite>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  private async isFavoritedByMe(capsuleId: string, viewerId: string | null): Promise<boolean> {
    if (!viewerId) return false;
    const fav = await this.favoriteRepo.findOne({
      where: { userId: viewerId, capsuleId },
    });
    return fav !== null;
  }

  private toCapsuleDetail(
    capsule: Capsule,
    owner: User,
    favoritedByMe: boolean,
    includeContent = true,
  ) {
    const opened = isOpened(capsule.openAt);
    return {
      id: capsule.id,
      code: capsule.code,
      title: capsule.title,
      creator: { nickname: owner.nickname, avatarId: owner.avatarId },
      openAt: capsule.openAt,
      createdAt: capsule.createdAt,
      inPlaza: capsule.inPlaza,
      favoriteCount: capsule.favoriteCount,
      isOpened: opened,
      content: includeContent && opened ? capsule.content : null,
      favoritedByMe,
    };
  }

  async create(owner: User, dto: {
    title: string;
    content: string;
    openAt: string;
    inPlaza: boolean;
  }) {
    const openAt = new Date(dto.openAt);
    if (isNaN(openAt.getTime())) {
      throw validationError('openAt 格式无效', 'openAt');
    }
    const now = new Date();
    const minOpenAt = new Date(now.getTime() + 60 * 1000);
    if (openAt <= minOpenAt) {
      throw validationError('开启时间必须在当前时间 60 秒后', 'openAt');
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const capsule = this.capsuleRepo.create({
        id: uuidv4(),
        ownerId: owner.id,
        code,
        title: dto.title,
        content: dto.content,
        openAt,
        inPlaza: dto.inPlaza,
        favoriteCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      try {
        await this.capsuleRepo.save(capsule);
        return this.toCapsuleDetail(capsule, owner, false, true);
      } catch (e: any) {
        if ((e?.message ?? '').toLowerCase().includes('code') || attempt < 4) continue;
        throw e;
      }
    }
    throw badRequest('生成唯一码失败');
  }

  async getByCode(code: string, viewerId: string | null) {
    const codeNorm = code.toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(codeNorm)) {
      throw validationError('code 格式无效，必须是 8 位大写字母或数字', 'code');
    }
    const capsule = await this.capsuleRepo.findOne({
      where: { code: codeNorm },
      relations: ['owner'],
    });
    if (!capsule) throw notFound('胶囊不存在');
    const favoritedByMe = await this.isFavoritedByMe(capsule.id, viewerId);
    return this.toCapsuleDetail(capsule, capsule.owner, favoritedByMe, true);
  }

  async deleteOwn(owner: User, capsuleId: string) {
    const capsule = await this.capsuleRepo.findOne({ where: { id: capsuleId } });
    if (!capsule) throw notFound('胶囊不存在');
    if (capsule.ownerId !== owner.id) throw forbidden('无权删除他人胶囊');
    await this.capsuleRepo.remove(capsule);
  }
}
