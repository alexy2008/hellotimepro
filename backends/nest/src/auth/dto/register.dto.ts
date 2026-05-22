import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 100)
  password: string;

  @IsString()
  @Length(2, 20)
  nickname: string;

  @IsString()
  @Matches(/^[a-z0-9_-]+$/, { message: 'avatarId must be alphanumeric' })
  avatarId: string;
}
