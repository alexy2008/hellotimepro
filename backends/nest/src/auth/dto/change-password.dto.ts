import { IsString, Length, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @Length(8, 128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/, { message: '密码至少包含一个字母和一个数字' })
  newPassword: string;
}
