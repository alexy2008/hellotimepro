import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CapsuleSuggestionRequestDto {
  // 可选：留空表示由 AI 同时生成标题（空标题模式）。
  @IsOptional()
  @IsString()
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
