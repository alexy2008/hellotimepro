/**
 * 与 spec/api/openapi.yaml 对齐的 TS 类型。前后端共用。
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export interface Envelope<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode: ErrorCode | null;
  details?: Array<{ field: string; message: string }>;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Avatar {
  id: string;
  name: string;
  primaryColor: string;
  svgUrl?: string;
}

export interface UserOut {
  id: string;
  email: string;
  nickname: string;
  avatarId: string;
  createdAt: string;
}

export type User = UserOut;

export interface UserBrief {
  nickname: string;
  avatarId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: UserOut;
}

export interface CapsuleBase {
  id: string;
  code: string;
  title: string;
  creator: UserBrief;
  openAt: string;
  createdAt: string;
  inPlaza: boolean;
  favoriteCount: number;
  isOpened: boolean;
}

export interface CapsuleDetail extends CapsuleBase {
  content: string | null;
  favoritedByMe: boolean;
}

export interface CapsuleListItem extends CapsuleBase {
  favoritedByMe: boolean;
  favoritedAt?: string | null;
  contentPreview?: string | null;
}

export interface FavoriteResult {
  capsuleId: string;
  favoriteCount: number;
  favoritedAt: string;
}

export interface PaginatedCapsules {
  items: CapsuleListItem[];
  pagination: Pagination;
}

export type PlazaSort = "hot" | "new";
export type PlazaFilter = "all" | "opened" | "unopened";

export interface PlazaQuery {
  sort?: PlazaSort;
  filter?: PlazaFilter;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateCapsuleRequest {
  title: string;
  content: string;
  openAt: string;
  inPlaza?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
  avatarId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  nickname?: string;
  avatarId?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CapsuleSuggestionRequest {
  title?: string;
  locale?: string;
}

export interface CapsuleSuggestion {
  title?: string;
  content: string;
  openInDays: number;
  openAt: string;
  generatedBy: string;
  cached: boolean;
}

export interface CapsuleRecommendation {
  title: string;
  hint: string;
  openInDays: number;
}

export interface CapsuleRecommendationList {
  items: CapsuleRecommendation[];
  generatedBy: string;
  cached: boolean;
}

export interface StackItem {
  role: string;
  name: string;
  version: string;
  iconUrl?: string | null;
  tagline?: string | null;
  features?: string[] | null;
}

export interface HealthData {
  status: "ok";
  service: string;
  version: string;
  uptimeSeconds: number;
  stack: { kind: "fullstack"; summary?: string; items: StackItem[] };
}

export class ApiError extends Error {
  status: number;
  errorCode: ErrorCode | null;
  details?: Array<{ field: string; message: string }>;
  constructor(
    message: string,
    status: number,
    errorCode: ErrorCode | null,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}
