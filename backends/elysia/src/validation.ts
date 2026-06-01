import { z } from "zod";
import { zodToApiError } from "./errors";

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const nicknameRegex = /^[\p{L}\p{N}_-]{2,20}$/u;
const avatarIdRegex = /^[a-z0-9-]+$/;

export const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确").max(254),
  password: z.string().min(8).max(128).regex(passwordRegex, "密码须含字母与数字"),
  nickname: z.string().min(2).max(20).regex(nicknameRegex, "昵称只能含字母/数字/下划线/连字符"),
  avatarId: z.string().min(2).max(20).regex(avatarIdRegex),
});

export const loginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export const logoutSchema = z.object({ refreshToken: z.string().optional() });

export const updateProfileSchema = z
  .object({
    nickname: z.string().min(2).max(20).regex(nicknameRegex).optional(),
    avatarId: z.string().min(2).max(20).regex(avatarIdRegex).optional(),
  })
  .strict()
  .refine((v) => v.nickname !== undefined || v.avatarId !== undefined, {
    message: "至少提交 nickname 或 avatarId 之一",
    path: ["_"],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128).regex(passwordRegex, "密码须含字母与数字"),
});

export const createCapsuleSchema = z.object({
  title: z.string().min(1).max(60),
  content: z.string().min(1).max(5000),
  openAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  inPlaza: z.boolean().optional(),
});

export const favoriteSchema = z.object({ capsuleId: z.string().min(1) });
export const suggestionSchema = z.object({
  // 可选：留空表示由 AI 同时生成标题（空标题模式）。
  title: z.string().max(60).optional(),
  locale: z.string().optional(),
});

export function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const r = schema.safeParse(value ?? {});
  if (!r.success) throw zodToApiError(r.error);
  return r.data;
}
