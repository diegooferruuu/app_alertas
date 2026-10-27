import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { VerificationService } from '../verification/verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EliminarCuentaDto } from './dto/eliminar-cuenta.dto';
import { CuentasService } from '../users/cuentas.service';
import {
  RegistrarDocumentoDto,
  ExtraerDatosDocumentoDto,
} from '../verification/dto/documento.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private verificationService: VerificationService,
    private cuentasService: CuentasService,
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

  @Post('documento/extraer')
  @UseGuards(JwtAuthGuard)
  async extraerDatosDocumento(
    @CurrentUser() user: any,
    @Body() dto: ExtraerDatosDocumentoDto,
  ) {
    return this.verificationService.extraerDatosDocumento(
      user.userId,
      dto.id_front_base64,
      dto.id_back_base64,
      dto.personal_data,
    );
  }

  @Post('documento/registrar')
  @UseGuards(JwtAuthGuard)
  async registrarDocumento(
    @CurrentUser() user: any,
    @Body() dto: RegistrarDocumentoDto,
  ) {
    return this.verificationService.registrarDocumento(
      user.userId,
      dto.id_front_base64,
      dto.id_back_base64,
      dto.selfie_base64,
      dto.personal_data,
    );
  }

  /**
   * Elimina la cuenta de la sesión. POST y no DELETE: lleva la contraseña en el
   * cuerpo, y un DELETE con cuerpo es algo que no todo cliente ni proxy respeta.
   */
  @Post('cuenta/eliminar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async eliminarCuenta(@CurrentUser() user: any, @Body() dto: EliminarCuentaDto) {
    return this.cuentasService.eliminar(user.userId, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    const fullUser = await this.usersService.findById(user.userId);
    return {
      id: fullUser.id,
      email: fullUser.email,
      full_name: fullUser.full_name,
      phone: fullUser.phone,
      documento_registrado: fullUser.documento_registrado,
      // Sin rol ni puntaje: no existen. El detalle de las sanciones —faltas y lo
      // que restringen— está en `GET /usuarios/me/sanciones`.
      estado_cuenta: fullUser.estado_cuenta,
    };
  }
}
