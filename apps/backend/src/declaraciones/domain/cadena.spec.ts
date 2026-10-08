import { createHash } from 'crypto';
import {
  CamposDelRegistro,
  calcularHashContenido,
  calcularHashRegistro,
  contieneSeparador,
  registroIntacto,
  verificarCadena,
} from './cadena';

const registroBase = (): CamposDelRegistro => ({
  denuncia_id: '11111111-1111-1111-1111-111111111111',
  usuario_id: '22222222-2222-2222-2222-222222222222',
  ci_hash_declarante: 'a'.repeat(64),
  vinculo_declarado: 'PADRE',
  tipo: 'original',
  version_texto_legal_id: '33333333-3333-3333-3333-333333333333',
  hash_texto_legal: 'b'.repeat(64),
  texto_firmado: 'María Fernanda Villarroel Quispe',
  hash_contenido_denuncia: 'c'.repeat(64),
  firmada_en: '2026-09-02T20:00:00.000Z',
  device_id: 'dispositivo-1',
  hash_anterior: null,
});

/** Encadena un registro tras otro, como haría el servicio al firmar. */
const encadenar = (registros: CamposDelRegistro[]) => {
  let anterior: string | null = null;
  return registros.map((campos) => {
    const conEnlace = { ...campos, hash_anterior: anterior };
    const hash_registro = calcularHashRegistro(conEnlace);
    anterior = hash_registro;
    return { ...conEnlace, hash_registro };
  });
};

describe('Cadena de hashes del paquete probatorio', () => {
  describe('sellado de un registro', () => {
    it('el mismo contenido produce siempre el mismo hash', () => {
      expect(calcularHashRegistro(registroBase())).toBe(
        calcularHashRegistro(registroBase()),
      );
    });

    it('cambiar cualquier campo cambia el hash', () => {
      const original = calcularHashRegistro(registroBase());

      expect(
        calcularHashRegistro({ ...registroBase(), vinculo_declarado: 'MADRE' }),
      ).not.toBe(original);
      expect(
        calcularHashRegistro({ ...registroBase(), texto_firmado: 'Otro Nombre' }),
      ).not.toBe(original);
    });

    it('distingue campos con espacios: el separador no puede ser un espacio', () => {
      // Con un espacio como separador, «Ana Luz» + «Pérez» y «Ana» + «Luz Pérez»
      // se serializarían igual y dos declaraciones distintas quedarían selladas
      // como si fueran la misma.
      const uno = calcularHashRegistro({
        ...registroBase(),
        texto_firmado: 'Ana Luz',
        hash_contenido_denuncia: 'Pérez',
      });
      const otro = calcularHashRegistro({
        ...registroBase(),
        texto_firmado: 'Ana',
        hash_contenido_denuncia: 'Luz Pérez',
      });

      expect(uno).not.toBe(otro);
    });

    it('detecta un registro alterado tras el sellado', () => {
      const campos = registroBase();
      const hash = calcularHashRegistro(campos);

      expect(registroIntacto(campos, hash)).toBe(true);
      expect(
        registroIntacto({ ...campos, texto_firmado: 'Nombre Cambiado' }, hash),
      ).toBe(false);
    });

    it('rechaza un campo que contenga el separador', () => {
      expect(contieneSeparador('nombre normal')).toBe(false);
      expect(contieneSeparador('nombre\x1Finyectado')).toBe(true);
    });
  });

  describe('firma del teléfono (H6.3)', () => {
    const firmado = () => ({
      ...registroBase(),
      clave_publica_id: '44444444-4444-4444-4444-444444444444',
      firma_criptografica: 'd'.repeat(128),
    });

    it('un registro sin firma conserva exactamente su hash de siempre', () => {
      // La fórmula de antes de la H6.3, escrita a mano: los 12 campos y nada
      // más. Si cambiara, ninguna constancia ya emitida se podría verificar.
      const r = registroBase();
      const formulaAnterior = createHash('sha256')
        .update(
          [
            r.denuncia_id,
            r.usuario_id,
            r.ci_hash_declarante,
            r.vinculo_declarado,
            r.tipo,
            r.version_texto_legal_id,
            r.hash_texto_legal,
            r.texto_firmado,
            r.hash_contenido_denuncia,
            r.firmada_en,
            r.device_id ?? '',
            r.hash_anterior ?? '',
          ].join('\x1F'),
          'utf8',
        )
        .digest('hex');

      expect(calcularHashRegistro(r)).toBe(formulaAnterior);
      expect(
        calcularHashRegistro({ ...r, clave_publica_id: null, firma_criptografica: null }),
      ).toBe(formulaAnterior);
    });

    it('la firma entra en el hash: quitarla o cambiarla después se detecta', () => {
      const sellado = calcularHashRegistro(firmado());

      expect(registroIntacto({ ...firmado(), firma_criptografica: null }, sellado)).toBe(false);
      expect(registroIntacto({ ...firmado(), firma_criptografica: 'e'.repeat(128) }, sellado)).toBe(
        false,
      );
      expect(registroIntacto({ ...firmado(), clave_publica_id: '5'.repeat(36) }, sellado)).toBe(false);
      expect(registroIntacto(firmado(), sellado)).toBe(true);
    });
  });

  describe('sellado del contenido de la denuncia', () => {
    // Los campos llegan ya en forma canónica de texto: es la propia función
    // `contenidoSellable` la que los produce así, y la constancia publica
    // exactamente estas cadenas.
    const contenido = {
      nombre_persona_buscada: 'Luis Mamani',
      ci_hash_persona_buscada: 'd'.repeat(64),
      fecha_nacimiento: '1990-04-12',
      sexo: 'MASCULINO',
      estatura_rango: 'DE_170_A_180',
      contextura: 'MEDIA',
      color_piel: 'TRIGUENA',
      color_cabello: 'NEGRO',
      color_ojos: 'CAFES_OSCUROS',
      senas_particulares: 'CICATRIZ,TATUAJE',
      ultimo_avistamiento_en: '2026-01-15T14:30:00.000Z',
      prenda_superior: 'CHOMPA',
      color_prenda_superior: 'AZUL',
      prenda_inferior: 'PANTALON_JEAN',
      color_prenda_inferior: 'NEGRO',
      calzado: 'ZAPATILLAS',
      circunstancia: 'SALIO_DE_CASA',
      condicion_relevante: 'REQUIERE_MEDICACION',
      latitude: '-16.5000000',
      longitude: '-68.1500000',
    };

    it('el mismo contenido produce el mismo hash', () => {
      expect(calcularHashContenido(contenido, 2)).toBe(
        calcularHashContenido({ ...contenido }, 2),
      );
    });

    it('cambiar un campo descriptivo cambia el hash: por eso se cierra la edición', () => {
      expect(
        calcularHashContenido({ ...contenido, prenda_superior: 'CASACA' }, 2),
      ).not.toBe(calcularHashContenido(contenido, 2));
    });

    it('la fórmula 1 ignora los campos que no existían cuando se escribió', () => {
      // Una denuncia vieja se sigue sellando como entonces. Si la fórmula 1
      // mirara los campos nuevos, toda constancia ya emitida dejaría de
      // verificar en cuanto la columna existiera.
      const vieja = { ...contenido, description: 'Visto el martes' };
      expect(
        calcularHashContenido({ ...vieja, prenda_superior: 'CASACA' }, 1),
      ).toBe(calcularHashContenido(vieja, 1));
    });

    it('la misma denuncia sellada con fórmulas distintas da hashes distintos', () => {
      expect(calcularHashContenido(contenido, 1)).not.toBe(
        calcularHashContenido(contenido, 2),
      );
    });

    it('una versión de fórmula inexistente falla en vez de sellar cualquier cosa', () => {
      expect(() => calcularHashContenido(contenido, 99)).toThrow(/versión 99/);
    });

    it('un valor múltiple en distinto orden es el mismo conjunto y debe sellar igual', () => {
      // Lo garantiza `normalizarMultiple` al guardar, no esta función: aquí se
      // fija que la forma canónica es la ordenada alfabéticamente.
      expect(
        calcularHashContenido(
          { ...contenido, senas_particulares: 'CICATRIZ,TATUAJE' },
          2,
        ),
      ).not.toBe(
        calcularHashContenido(
          { ...contenido, senas_particulares: 'TATUAJE,CICATRIZ' },
          2,
        ),
      );
    });
  });

  describe('verificación de la cadena', () => {
    it('una cadena bien formada se verifica sin errores', () => {
      const cadena = encadenar([
        registroBase(),
        { ...registroBase(), texto_firmado: 'Segunda Persona Firmante' },
        { ...registroBase(), texto_firmado: 'Tercera Persona Firmante' },
      ]);

      expect(verificarCadena(cadena)).toBeNull();
    });

    it('detecta el registro alterado y señala cuál', () => {
      const cadena = encadenar([
        registroBase(),
        { ...registroBase(), texto_firmado: 'Segunda Persona Firmante' },
        { ...registroBase(), texto_firmado: 'Tercera Persona Firmante' },
      ]);

      cadena[1].vinculo_declarado = 'MADRE';

      expect(verificarCadena(cadena)).toBe(1);
    });

    it('detecta que se suprimió un registro intermedio', () => {
      // Es lo que hace verificable el registro frente a quien opera el sistema:
      // borrar una declaración incómoda deja el eslabón siguiente huérfano.
      const cadena = encadenar([
        registroBase(),
        { ...registroBase(), texto_firmado: 'Segunda Persona Firmante' },
        { ...registroBase(), texto_firmado: 'Tercera Persona Firmante' },
      ]);

      const mutilada = [cadena[0], cadena[2]];

      expect(verificarCadena(mutilada)).toBe(1);
    });

    it('detecta un registro insertado al final sin encadenar', () => {
      const cadena = encadenar([registroBase()]);
      const fabricado: CamposDelRegistro & { hash_registro: string } = {
        ...registroBase(),
        texto_firmado: 'Declaración Fabricada',
        hash_anterior: null,
        hash_registro: 'f'.repeat(64),
      };

      expect(verificarCadena([...cadena, fabricado])).toBe(1);
    });

    it('una cadena vacía es válida: todavía no hay nada que verificar', () => {
      expect(verificarCadena([])).toBeNull();
    });
  });
});
