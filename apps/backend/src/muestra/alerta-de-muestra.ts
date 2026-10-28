import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { generateKeyPairSync, randomBytes, sign } from 'crypto';
import * as bcryptjs from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { hashDeDocumento } from '../users/domain/documento-identidad';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { DenunciasService } from '../denuncias/denuncias.service';
import { CreateDenunciaDto } from '../denuncias/dto/create-denuncia.dto';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { FirmasService } from '../declaraciones/firmas.service';
import { DeclaracionesService } from '../declaraciones/declaraciones.service';
import { VinculoDeclarado } from '../declaraciones/domain/vinculos';
import { mensajeAFirmar, mensajeDeProlongacion } from '../declaraciones/domain/firma-dispositivo';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/**
 * La cuenta que presenta la alerta de muestra.
 *
 * Nace con el documento ya registrado, como la de revisión de Google Play: el
 * carnet de 12 cifras no lo tiene nadie, así que no hay foto que pasar por el
 * OCR. Nadie entra con ella: su contraseña es un hash de bytes al azar que no
 * se guarda en ningún lado.
 */
export const CUENTA_DE_MUESTRA = {
  correo: 'muestra@alertatemprana.test',
  nombre: 'Cuenta de Muestra',
  carnet: '999999999902',
} as const;

/** La persona «buscada». El nombre dice lo que es a quien vea la lista. */
export const PERSONA_DE_MUESTRA = {
  nombre: 'Persona de Ejemplo',
  carnet: '999999999903',
} as const;

/**
 * En medio del Salar de Uyuni.
 *
 * Firmar notifica una vez a quien esté a 2 km, y ahí no hay nadie con la app:
 * la alerta de muestra no puede despertar a ningún tester. La lista
 * «Denuncias» no filtra por distancia, así que el revisor la ve desde donde
 * esté.
 */
export const ZONA_DE_MUESTRA = { latitude: -20.25, longitude: -67.55 } as const;

/**
 * Horas que tienen que quedarle a la alerta para no tocarla.
 *
 * Corrido cada 6 horas, el comando la prolonga cuando entra en sus últimas 12 y
 * nunca llega a vencer.
 */
export const MARGEN_H = 12;

export type AccionDeMuestra = 'creada' | 'vigente' | 'prolongada' | 'renovada';

/**
 * Mantiene una alerta difundiéndose para que el revisor de Google Play
 * encuentre «Reportar contenido inapropiado», que solo aparece en la alerta de
 * otra cuenta.
 *
 * No se salta ninguna regla: crea, firma, prolonga y cierra con los mismos
 * servicios que la app, y firma con una clave Ed25519 como el teléfono. Cuando
 * se le acaban las prolongaciones, la da por encontrada y presenta otra.
 */
@Injectable()
export class AlertaDeMuestra {
  constructor(
    private dataSource: DataSource,
    private denunciasService: DenunciasService,
    private firmasService: FirmasService,
    private declaracionesService: DeclaracionesService,
    private configService: ConfigService
  ) {}

  private get config(): DenunciasConfig {
    return this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);
  }

  /** Deja la alerta a la vista y dice qué tuvo que hacer para eso. */
  async mantener(
    fotografiaBase64: string
  ): Promise<{ accion: AccionDeMuestra; denunciaId: string; expiraEn: Date }> {
    const cuenta = await this.cuenta();
    const abierta = await this.dataSource.getRepository(Denuncia).findOne({
      where: {
        denunciante_id: cuenta.id,
        estado: In([EstadoDenuncia.ACTIVA, EstadoDenuncia.CADUCADA]),
      },
    });

    let accion: AccionDeMuestra;
    let denunciaId: string;
    if (abierta?.nivel_confianza === NivelConfianza.REGISTRADA) {
      // Una corrida anterior la presentó y se cortó antes de firmar.
      await this.firmar(cuenta, abierta.id);
      [accion, denunciaId] = ['creada', abierta.id];
    } else if (abierta && this.horasQueLeQuedan(abierta) > MARGEN_H) {
      [accion, denunciaId] = ['vigente', abierta.id];
    } else if (abierta && abierta.prolongaciones < this.config.maxProlongaciones) {
      await this.prolongar(cuenta, abierta);
      [accion, denunciaId] = ['prolongada', abierta.id];
    } else {
      if (abierta) await this.denunciasService.darPorEncontrada(cuenta.id, abierta.id);
      const nueva = await this.denunciasService.create(
        cuenta.id,
        this.formulario(fotografiaBase64)
      );
      await this.firmar(cuenta, nueva.id);
      [accion, denunciaId] = [abierta ? 'renovada' : 'creada', nueva.id];
    }

    const { expira_en } = await this.dataSource
      .getRepository(Denuncia)
      .findOneByOrFail({ id: denunciaId });
    return { accion, denunciaId, expiraEn: expira_en! };
  }

  /**
   * La cuenta de muestra, creada si no existe.
   *
   * Se busca por el hash del carnet y no por el correo: eliminar una cuenta le
   * cambia el correo pero le deja el hash, y crear otra con el mismo carnet
   * chocaría con la unicidad.
   */
  private async cuenta(): Promise<User> {
    const usuarios = this.dataSource.getRepository(User);
    const ciHash = hashDeDocumento(CUENTA_DE_MUESTRA.carnet);
    const existente = await usuarios.findOne({ where: { ci_hash: ciHash } });
    if (existente?.deleted_at) {
      throw new Error('La cuenta de muestra fue eliminada: su carnet ya no puede volver a usarse.');
    }
    if (existente) return existente;

    return usuarios.save(
      usuarios.create({
        full_name: CUENTA_DE_MUESTRA.nombre,
        primer_nombre: 'Cuenta',
        primer_apellido: 'de',
        segundo_apellido: 'Muestra',
        email: CUENTA_DE_MUESTRA.correo,
        password_hash: await bcryptjs.hash(randomBytes(32).toString('hex'), 10),
        documento_registrado: true,
        ci_hash: ciHash,
        documento_registrado_en: new Date(),
        nombre_documento: CUENTA_DE_MUESTRA.nombre,
      })
    );
  }

  /** Una vencida, aunque el planificador todavía no la haya marcado, no tiene horas. */
  private horasQueLeQuedan(denuncia: Denuncia): number {
    if (denuncia.estado !== EstadoDenuncia.ACTIVA || !denuncia.expira_en) return 0;
    return (denuncia.expira_en.getTime() - Date.now()) / 3_600_000;
  }

  private formulario(fotografiaBase64: string): CreateDenunciaDto {
    return {
      nombre_persona_buscada: PERSONA_DE_MUESTRA.nombre,
      ci_persona_buscada: PERSONA_DE_MUESTRA.carnet,
      fecha_nacimiento: '1994-03-12',
      sexo: 'MASCULINO',
      estatura_rango: 'DE_170_A_180',
      contextura: 'MEDIA',
      color_piel: 'TRIGUENA',
      color_cabello: 'NEGRO',
      color_ojos: 'CAFES_OSCUROS',
      ultimo_avistamiento_en: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      prenda_superior: 'CHOMPA',
      color_prenda_superior: 'AZUL',
      prenda_inferior: 'PANTALON_JEAN',
      color_prenda_inferior: 'NEGRO',
      calzado: 'ZAPATILLAS',
      circunstancia: 'SALIO_DE_CASA',
      ...ZONA_DE_MUESTRA,
      fotografia_base64: fotografiaBase64,
    };
  }

  /**
   * Un teléfono de una sola firma: genera la clave, la registra y la descarta.
   * Lo firmado sigue siendo verificable con la pública, que queda registrada.
   */
  private async telefono(usuarioId: string) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const clavePublica = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url').toString(
      'hex'
    );
    const { id } = await this.firmasService.registrarClave(usuarioId, clavePublica);
    return {
      claveId: id,
      firmar: (mensaje: string) =>
        sign(null, Buffer.from(mensaje, 'utf8'), privateKey).toString('hex'),
    };
  }

  private async firmar(cuenta: User, denunciaId: string): Promise<void> {
    const version = await this.declaracionesService.textoLegalVigente();
    const { hash_contenido_denuncia } = await this.firmasService.contenidoAFirmar(
      cuenta.id,
      denunciaId
    );
    const telefono = await this.telefono(cuenta.id);
    // Un vínculo familiar: con uno de terceros la alerta viviría la mitad.
    const vinculo = VinculoDeclarado.HERMANO_A;

    await this.firmasService.firmar(cuenta.id, denunciaId, {
      version_texto_legal_id: version.id,
      vinculo_declarado: vinculo,
      nombre_escrito: CUENTA_DE_MUESTRA.nombre,
      clave_dispositivo_id: telefono.claveId,
      firma_dispositivo: telefono.firmar(
        mensajeAFirmar({
          denuncia_id: denunciaId,
          hash_contenido_denuncia,
          hash_texto_legal: version.hash_texto,
          vinculo_declarado: vinculo,
          texto_firmado: CUENTA_DE_MUESTRA.nombre,
        })
      ),
    });
  }

  private async prolongar(cuenta: User, denuncia: Denuncia): Promise<void> {
    const version = await this.declaracionesService.textoLegalVigente();
    const telefono = await this.telefono(cuenta.id);

    await this.firmasService.prolongar(cuenta.id, denuncia.id, {
      version_texto_legal_id: version.id,
      clave_dispositivo_id: telefono.claveId,
      firma_dispositivo: telefono.firmar(
        mensajeDeProlongacion({
          denuncia_id: denuncia.id,
          numero: String(denuncia.prolongaciones + 1),
          hash_texto_legal: version.hash_texto,
        })
      ),
    });
  }
}
