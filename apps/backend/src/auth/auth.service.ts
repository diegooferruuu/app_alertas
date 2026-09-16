import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcryptjs from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { normalizarCorreo } from '../users/domain/correo';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const {
      email,
      password,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      phone,
    } = registerDto;

    // Hash password
    const passwordHash = await bcryptjs.hash(password, 10);

    // Create user. El nombre completo lo compone `UsersService` a partir de las
    // partes; aquí no se arma para que exista una sola forma de componerlo.
    const user = await this.usersService.create({
      email,
      password_hash: passwordHash,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      phone,
    });

    return this.generateTokens(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    // Se distingue en el registro entre «no existe esa cuenta» y «la contraseña
    // no coincide». Hacia afuera la respuesta es la misma —decirle a un extraño
    // cuáles correos existen sería un buscador de cuentas—, pero sin esta
    // distinción en los registros, depurar un fallo de ingreso es adivinar.
    if (!user) {
      this.logger.warn(
        `Ingreso rechazado: no existe la cuenta ${normalizarCorreo(email)}`,
      );
      return null;
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);

    if (!isPasswordValid) {
      this.logger.warn(
        `Ingreso rechazado: contraseña incorrecta para ${user.email}`,
      );
      return null;
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        documento_registrado: user.documento_registrado,
      },
    };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
