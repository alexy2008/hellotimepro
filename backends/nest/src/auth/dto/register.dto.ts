import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/, { message: '密码至少包含一个字母和一个数字' })
  password: string;

  @IsString()
  @Length(2, 20)
  @Matches(/^[\p{L}\p{N}_-]{2,20}$/u, { message: 'nickname 只能包含字母、数字、下划线或连字符' })
  nickname: string;

  @IsString()
  @Matches(/^[a-z0-9_-]+$/, { message: 'avatarId must be alphanumeric' })
  avatarId: string;
}
