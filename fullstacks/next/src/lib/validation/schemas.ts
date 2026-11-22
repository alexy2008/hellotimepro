/**
 * Zod 校验 schema · 与 spec/api/openapi.yaml 的请求体规则对齐。
 */
import { z } from "zod";

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;
const nicknameRegex = /^[\p{L}\p{N}_-]{2,20}$/u;
const avatarIdRegex = /^[a-z0-9-]+$/;

export const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确").max(254),
  password: z
    .string()
    .min(8, "密码长度至少 8 位")
    .max(128, "密码长度最多 128 位")
    .regex(passwordRegex, "密码须含字母与数字"),
  nickname: z
    .string()
    .regex(nicknameRegex, "昵称只能含字母/数字/下划线/连字符"),
  avatarId: z.string().min(2).max(20).regex(avatarIdRegex, "avatarId 只能含小写字母/数字/连字符"),
});

export const loginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const updateProfileSchema = z
  .object({
    nickname: z.string().regex(nicknameRegex).optional(),
    avatarId: z.string().min(2).max(20).regex(avatarIdRegex).optional(),
  })
  .strict()
  .refine((v) => v.nickname !== undefined || v.avatarId !== undefined, {
    message: "至少提交 nickname 或 avatarId 之一",
    path: ["_"],
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(passwordRegex, "密码须含字母与数字"),
});

export const createCapsuleSchema = z.object({
  title: z.string().min(1).refine((s) => Array.from(s).length <= 60, "最多 60 字"),
  content: z.string().min(1).refine((s) => Array.from(s).length <= 5000, "最多 5000 字"),
  openAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  inPlaza: z.boolean().optional(),
});

// 胶囊 id：标准 UUID（也接受无连字符的 32 位十六进制，与 fastapi 的 uuid.UUID 一致）
const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export const favoriteSchema = z.object({
  capsuleId: z.string().regex(uuidRegex, "capsuleId 不是合法的 UUID"),
});

export const capsuleSuggestionSchema = z.object({
  // 留空表示由 AI 同时生成标题（空标题模式）
  title: z.string().refine((s) => Array.from(s).length <= 60, "最多 60 字").optional(),
  locale: z.string().optional(),
});

/** 把 zod issues 映射成 spec 里 ErrorDetail 数组。 */
export function zodIssuesToDetails(err: z.ZodError): { field: string; message: string }[] {
  return err.issues.map((i) => ({
    field: i.path.length ? i.path.join(".") : "_",
    message: i.message,
  }));
}
