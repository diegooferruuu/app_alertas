import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // La firma solo dice que el token lo emitimos; no que la cuenta siga
    // existiendo. Una eliminada no puede seguir actuando con lo que le queda de
    // sesión.
    if (!(await this.usersService.estaActiva(payload.sub))) {
      throw new UnauthorizedException('La cuenta ya no existe');
    }
    return { userId: payload.sub, email: payload.email };
  }
}
