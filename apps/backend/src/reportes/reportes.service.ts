import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReporteContenido, MotivoDeReporte } from './entities/reporte-contenido.entity';
import { ReportarContenidoDto } from './dto/reportar-contenido.dto';
import { CorreoService } from './correo.service';
import { DenunciasService } from '../denuncias/denuncias.service';
import { CONTACTO_CONFIG, ContactoConfig } from '../config/contacto.config';

const ETIQUETA_MOTIVO: Record<MotivoDeReporte, string> = {
  imagen_inapropiada: 'Imagen inapropiada',
  contenido_ofensivo: 'Contenido ofensivo',
  no_es_una_desaparicion: 'No es una desaparición',
  otro: 'Otro',
};

/**
 * La respuesta es la misma la primera vez y las siguientes: decir «ya lo
 * habías reportado» no le sirve a nadie, y el aviso solo sale una vez.
 */
export const MENSAJE_REPORTE_RECIBIDO =
  'Gracias. Vamos a revisar esta alerta y, si su contenido no corresponde, dejará de mostrarse.';

/**
 * Reportes del contenido de una alerta (política de contenido generado por
 * usuarios de Google Play).
 *
 * Reportar avisa; no decide. El reporte queda guardado y le llega por correo a
 * quien opera el sistema, que puede ocultar la foto y el relato de la vista de
 * terceros (`deploy/ocultar-contenido.sh`). Nada de esto borra, cierra ni
 * sanciona (I7, I9): «es falsa» solo lo puede decir la persona reportada.
 */
@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(
    @InjectRepository(ReporteContenido)
    private reportes: Repository<ReporteContenido>,
    private denunciasService: DenunciasService,
    private correo: CorreoService,
    private configService: ConfigService
  ) {}

  async reportar(
    userId: string,
    denunciaId: string,
    dto: ReportarContenidoDto
  ): Promise<{ mensaje: string }> {
    // Con las reglas de quién puede verla: no se reporta lo que no se ve, y una
    // que no se puede ver responde igual que una que no existe.
    const denuncia = await this.denunciasService.findVisiblePara(userId, denunciaId);
    if (denuncia.denunciante_id === userId) {
      throw new BadRequestException('No puedes reportar tu propia denuncia');
    }

    const { raw } = await this.reportes
      .createQueryBuilder()
      .insert()
      .values({
        denuncia_id: denunciaId,
        usuario_id: userId,
        motivo: dto.motivo,
        detalle: dto.detalle ?? null,
      })
      .orIgnore()
      .returning('id')
      .execute();

    if (raw.length > 0) {
      // Sin esperar: el aviso no puede demorar ni hacer fallar el reporte, que
      // ya quedó guardado.
      void this.avisar(denunciaId, dto);
    }
    return { mensaje: MENSAJE_REPORTE_RECIBIDO };
  }

  /**
   * El aviso no lleva el nombre de la persona buscada ni quién reportó: con el
   * identificador y el enlace a la ficha alcanza para revisarla, y lo que no
   * viaja por correo no se puede filtrar por correo.
   */
  private async avisar(denunciaId: string, dto: ReportarContenidoDto): Promise<void> {
    try {
      await this.enviarAviso(denunciaId, dto);
    } catch (error) {
      // Nadie espera esta promesa: un error aquí no tiene a quién llegar.
      this.logger.error(`No se pudo preparar el aviso de un reporte: ${(error as Error).message}`);
    }
  }

  private async enviarAviso(denunciaId: string, dto: ReportarContenidoDto): Promise<void> {
    const total = await this.reportes.countBy({ denuncia_id: denunciaId });
    const yaOculta = await this.denunciasService.estaOculta(denunciaId);
    const sitio = this.configService.get<ContactoConfig>(CONTACTO_CONFIG)?.sitio ?? null;

    await this.correo.avisar(
      `Reporte de contenido: ${ETIQUETA_MOTIVO[dto.motivo]}`,
      [
        'Reportaron el contenido de una alerta.',
        '',
        `Alerta: ${denunciaId}`,
        `Motivo: ${ETIQUETA_MOTIVO[dto.motivo]}`,
        `Detalle: ${dto.detalle ?? '—'}`,
        `Reportes de esta alerta: ${total}`,
        sitio ? `Ficha pública: ${sitio}/api/fichas/${denunciaId}` : null,
        '',
        yaOculta
          ? 'Su contenido ya está oculto.'
          : [
              'Para ocultar la foto y el relato a quien no la presentó (no borra nada):',
              `  ssh oracle '~/alertas/deploy/ocultar-contenido.sh ${denunciaId} "motivo"'`,
            ].join('\n'),
        // Ocultar deja la imagen guardada. Si es abuso sexual infantil, no puede
        // quedarse: se borra y se denuncia (estándares de seguridad infantil).
        dto.motivo === 'imagen_inapropiada'
          ? [
              '',
              'Si es abuso sexual infantil, bórrala del todo y denúncialo:',
              `  ssh oracle '~/alertas/deploy/borrar-imagen.sh ${denunciaId} "motivo"'`,
            ].join('\n')
          : null,
      ]
        .filter((linea) => linea !== null)
        .join('\n')
    );
  }
}
