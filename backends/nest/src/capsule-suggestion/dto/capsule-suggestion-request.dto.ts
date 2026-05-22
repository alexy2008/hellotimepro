import { IsString, Length } from 'class-validator';

export class CapsuleSuggestionRequestDto {
  @IsString()
  @Length(1, 60)
  title: string;
}
