import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Este controlador casi no expone nada, y es deliberado.
 *
 * No hay ruta para consultar la ficha de otra persona. La había —`GET /users/:id`,
 * sin autenticación, devolviendo todo menos la contraseña— y era el segundo
 * eslabón de una cadena de dos: de una denuncia salía el identificador de quien
 * la firmó, y de ahí su nombre, su correo, su teléfono, el hash de su documento
 * y su última ubicación conocida. Eso anulaba a la vez el invariante I8 —la
 * identidad del denunciante solo se entrega por la constancia— y la razón de
 * guardar el documento como hash.
 *
 * Tampoco hay ruta para editar una cuenta. La había —`PUT /users/:id`— pero
 * estaba muerta (nadie la llamaba) y rota (el `ValidationPipe` la rechazaba
 * siempre), y su arreglo natural habría sido dañino: dejaba editar `full_name`,
 * que se fija al nombre del documento justo para que nadie firme una declaración
 * jurada con un nombre y muestre otro. Cuando de verdad haga falta editar el
 * perfil, será un contrato propio y acotado —cambio de contraseña y de correo
 * como flujos separados—, no un PATCH genérico sobre toda la entidad.
 *
 * Cada quien ve su propia cuenta por `/auth/me`.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Get('profile/me')
  async getProfile() {
    return { message: 'Profile endpoint - to be implemented' };
  }
}
