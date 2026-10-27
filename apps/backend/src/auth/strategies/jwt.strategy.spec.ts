import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

const estrategia = (activa: boolean) =>
  new JwtStrategy(
    {
      get: () => 'secreto-de-pruebas-con-mas-de-treinta-y-dos-caracteres',
    } as unknown as ConfigService,
    { estaActiva: jest.fn(async () => activa) } as unknown as UsersService
  );

describe('JwtStrategy', () => {
  it('acepta el token de una cuenta que existe', async () => {
    await expect(estrategia(true).validate({ sub: 'u1', email: 'a@b.bo' })).resolves.toEqual({
      userId: 'u1',
      email: 'a@b.bo',
    });
  });

  it('rechaza un token bien firmado de una cuenta eliminada', async () => {
    // El token dura quince minutos después de eliminar la cuenta: sin esto,
    // seguiría pudiendo denunciar o firmar en nombre de una cuenta que no existe.
    await expect(estrategia(false).validate({ sub: 'u1', email: 'a@b.bo' })).rejects.toThrow(
      UnauthorizedException
    );
  });
});
