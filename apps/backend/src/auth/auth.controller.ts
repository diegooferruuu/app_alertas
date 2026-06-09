import { Controller, Post, Body, UseGuards, Get, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerificationService } from '../verification/verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyIdentityDto, VerifyIdCardDto } from '../verification/dto/verify-identity.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private verificationService: VerificationService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('verify-id')
  @UseGuards(JwtAuthGuard)
  async verifyIdCard(
    @CurrentUser() user: any,
    @Body() verifyIdCardDto: VerifyIdCardDto,
  ) {
    return this.verificationService.verifyIdCard(
      user.userId,
      verifyIdCardDto.id_front_base64,
      verifyIdCardDto.id_back_base64,
      verifyIdCardDto.personal_data,
    );
  }

  @Post('verify-identity')
  @UseGuards(JwtAuthGuard)
  async verifyIdentity(
    @CurrentUser() user: any,
    @Body() verifyIdentityDto: VerifyIdentityDto,
  ) {
    return this.verificationService.verifyIdentity(
      user.userId,
      verifyIdentityDto.id_front_base64,
      verifyIdentityDto.id_back_base64,
      verifyIdentityDto.selfie_base64,
      verifyIdentityDto.personal_data,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return user;
  }
}
