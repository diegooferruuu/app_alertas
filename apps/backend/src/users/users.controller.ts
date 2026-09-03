import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * No hay ruta para consultar la ficha de otra persona, y es deliberado.
 *
 * La había —`GET /users/:id`, sin autenticación, devolviendo todo menos la
 * contraseña— y era el segundo eslabón de una cadena de dos: de una denuncia
 * salía el identificador de quien la firmó, y de ahí su nombre, su correo, su
 * teléfono, el hash de su documento y su última ubicación conocida. Eso anulaba
 * a la vez el invariante I8 —la identidad del denunciante solo se entrega por la
 * constancia— y la razón de guardar el documento como hash.
 *
 * El sistema no necesita esa consulta: nadie mira el perfil de nadie. Cada quien
 * ve el suyo por `/auth/me`.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile/me')
  async getProfile() {
    return { message: 'Profile endpoint - to be implemented' };
  }

  @Put(':id')
  async updateUser(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Sin esta comprobación, cualquiera con sesión podía reescribir el nombre y
    // el correo de otra cuenta —incluido el de un denunciante— pasando su id.
    if (id !== user.userId) {
      throw new ForbiddenException('Solo puedes modificar tu propia cuenta');
    }
    const actualizado = await this.usersService.update(id, updateUserDto);
    const { password_hash, ci_hash, ...sinSecretos } = actualizado;
    return sinSecretos;
  }
}
