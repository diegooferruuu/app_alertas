import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { ReportarContenidoDto } from './reportar-contenido.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validar = (cuerpo: object) =>
  pipe.transform(cuerpo, { type: 'body', metatype: ReportarContenidoDto, data: '' });

describe('ReportarContenidoDto', () => {
  it('acepta un motivo conocido con o sin detalle', async () => {
    await expect(validar({ motivo: 'imagen_inapropiada' })).resolves.toBeInstanceOf(
      ReportarContenidoDto
    );
    await expect(validar({ motivo: 'otro', detalle: 'Es una broma' })).resolves.toMatchObject({
      detalle: 'Es una broma',
    });
  });

  it('no existe «la denuncia es falsa»: eso solo lo declara la persona reportada', async () => {
    await expect(validar({ motivo: 'denuncia_falsa' })).rejects.toThrow(BadRequestException);
  });

  it('un detalle en blanco cuenta como ausente', async () => {
    const dto = await validar({ motivo: 'otro', detalle: '   ' });

    expect(dto.detalle).toBeUndefined();
  });

  it('rechaza un detalle de más de 500 caracteres', async () => {
    await expect(validar({ motivo: 'otro', detalle: 'x'.repeat(501) })).rejects.toThrow(
      BadRequestException
    );
  });
});
