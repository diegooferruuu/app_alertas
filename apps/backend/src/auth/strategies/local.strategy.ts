import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      // `UnauthorizedException` y no un `Error` a secas: el filtro global solo
      // conserva el código de estado de las excepciones HTTP, así que un Error
      // genérico convertía cualquier credencial equivocada en un 500 y la app
      // mostraba «Request failed with status code 500» en vez del motivo.
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }
}
