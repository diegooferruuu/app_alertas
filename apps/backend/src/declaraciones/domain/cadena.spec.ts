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

  describe('sellado del contenido de la denuncia', () => {
    const contenido = {
      nombre_persona_buscada: 'Luis Mamani',
      ci_hash_persona_buscada: 'd'.repeat(64),
      description: 'Visto el martes en la plaza',
      latitude: -16.5,
      longitude: -68.15,
    };

    it('el mismo contenido produce el mismo hash', () => {
      expect(calcularHashContenido(contenido)).toBe(
        calcularHashContenido({ ...contenido }),
      );
    });

    it('cambiar la descripción cambia el hash: por eso se cierra la edición', () => {
      expect(
        calcularHashContenido({ ...contenido, description: 'Otra cosa' }),
      ).not.toBe(calcularHashContenido(contenido));
    });

    it('fija la precisión de las coordenadas para que el hash sea estable', () => {
      // Sin fijar decimales, la representación de un flotante puede variar y el
      // mismo punto produciría hashes distintos.
      expect(calcularHashContenido({ ...contenido, latitude: -16.5000000 })).toBe(
        calcularHashContenido(contenido),
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
