import { IsBoolean, IsDateString, IsString, Length } from 'class-validator';

export class CreateCapsuleDto {
  @IsString()
  @Length(1, 60)
  title: string;

  @IsString()
  @Length(1, 5000)
  content: string;

  @IsDateString()
  openAt: string;

  @IsBoolean()
  inPlaza: boolean;
}
