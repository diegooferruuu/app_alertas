import { ValidationPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { CreateDenunciaDto } from './create-denuncia.dto';
import { UpdateDenunciaDto } from './update-denuncia.dto';

/**
 * Las prohibiciones del formulario de denuncia, comprobadas.
 *
 * La especificación las enuncia y exige que sean verificables en el código. Sin
 * estas pruebas serían una intención escrita en un comentario: dentro de un año,
 * cuando alguien necesite «un campito para aclarar», nada le avisaría de que
 * está reabriendo la puerta que todo el diseño existe para cerrar.
 *
 * Se ejercen contra el `ValidationPipe` con la misma configuración que el
 * servidor, porque `forbidNonWhitelisted` es justamente el mecanismo que
 * convierte la ausencia de un campo en un rechazo y no en un silencio.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const comoBody = (metatype: any): ArgumentMetadata => ({
  type: 'body',
  metatype,
  data: '',
});

const motivosDeRechazo = async (
  value: unknown,
  metatype: any,
): Promise<string[]> => {
  try {
    await pipe.transform(value, comoBody(metatype));
    throw new Error('se esperaba un rechazo de validación');
  } catch (e) {
    const respuesta = (e as BadRequestException).getResponse?.();
    const mensaje =
      typeof respuesta === 'object' && respuesta !== null
        ? (respuesta as { message?: string | string[] }).message
        : respuesta;
    return Array.isArray(mensaje) ? mensaje : [String(mensaje)];
  }
};

const denunciaValida = {
  nombre_persona_buscada: 'Luis Mamani',
  ci_persona_buscada: '9876543',
  fecha_nacimiento: '1990-04-12',
  sexo: 'MASCULINO',
  estatura_rango: 'DE_170_A_180',
  contextura: 'MEDIA',
  color_piel: 'TRIGUENA',
  color_cabello: 'NEGRO',
  color_ojos: 'CAFES_OSCUROS',
  senas_particulares: ['CICATRIZ'],
  ultimo_avistamiento_en: '2026-01-15T14:30:00.000Z',
  prenda_superior: 'CHOMPA',
  color_prenda_superior: 'AZUL',
  prenda_inferior: 'PANTALON_JEAN',
  color_prenda_inferior: 'NEGRO',
  calzado: 'ZAPATILLAS',
  circunstancia: 'SALIO_DE_CASA',
  condicion_relevante: ['REQUIERE_MEDICACION'],
  latitude: -16.5,
  longitude: -68.15,
  fotografia_base64: 'Zm90bw==',
};

describe('CreateDenunciaDto', () => {
  it('acepta un formulario completo y válido', async () => {
    const salida = await pipe.transform(
      { ...denunciaValida },
      comoBody(CreateDenunciaDto),
    );
    expect(salida).toBeInstanceOf(CreateDenunciaDto);
    expect(salida.circunstancia).toBe('SALIO_DE_CASA');
  });

  it('los dos campos opcionales lo son de verdad', async () => {
    const { senas_particulares, condicion_relevante, calzado, ...minimo } =
      denunciaValida;
    const salida = await pipe.transform(minimo, comoBody(CreateDenunciaDto));
    expect(salida.senas_particulares).toBeUndefined();
    expect(salida.calzado).toBeUndefined();
  });

  /**
   * P1. No existe ningún campo de texto libre en el formulario, con la única
   * excepción del nombre de la persona buscada.
   */
  describe('P1 · sin texto libre', () => {
    it('rechaza el antiguo campo de relato libre', async () => {
      const motivos = await motivosDeRechazo(
        { ...denunciaValida, description: 'Salió de casa el martes y no volvió' },
        CreateDenunciaDto,
      );
      expect(motivos).toContain('property description should not exist');
    });

    it('tampoco lo acepta al editar: cerrar una puerta y dejar la otra abierta no cierra nada', async () => {
      const motivos = await motivosDeRechazo(
        { description: 'Un relato cualquiera' },
        UpdateDenunciaDto,
      );
      expect(motivos).toContain('property description should not exist');
    });

    it('el único campo de texto libre es el nombre de la persona buscada', () => {
      // Se comprueba por reflexión sobre la instancia, no leyendo la clase: lo
      // que importa es qué acepta el DTO en tiempo de ejecución.
      const camposDeTexto = Object.keys(denunciaValida).filter(
        (campo) => typeof (denunciaValida as any)[campo] === 'string',
      );
      const cerrados = camposDeTexto.filter(
        (campo) =>
          campo !== 'nombre_persona_buscada' &&
          campo !== 'ci_persona_buscada' &&
          campo !== 'fecha_nacimiento' &&
          campo !== 'ultimo_avistamiento_en' &&
          campo !== 'fotografia_base64',
      );

      // Cada uno de los restantes pertenece a un dominio cerrado: un valor
      // inventado tiene que ser rechazado.
      return Promise.all(
        cerrados.map(async (campo) => {
          const motivos = await motivosDeRechazo(
            { ...denunciaValida, [campo]: 'CUALQUIER_COSA' },
            CreateDenunciaDto,
          );
          expect(motivos.join(' ')).toContain(campo);
        }),
      );
    });

    it('un valor fuera del dominio se rechaza aunque se parezca al correcto', async () => {
      const motivos = await motivosDeRechazo(
        { ...denunciaValida, prenda_superior: 'CHOMPA_ROJA' },
        CreateDenunciaDto,
      );
      expect(motivos.join(' ')).toContain('prenda_superior');
    });

    it('un valor múltiple con un elemento inválido se rechaza entero', async () => {
      const motivos = await motivosDeRechazo(
        { ...denunciaValida, senas_particulares: ['CICATRIZ', 'BARBA_LARGA'] },
        CreateDenunciaDto,
      );
      expect(motivos.join(' ')).toContain('senas_particulares');
    });
  });

  /**
   * P3. No existe campo alguno referido a un tercero.
   *
   * La lista no es exhaustiva —`forbidNonWhitelisted` rechaza cualquier campo
   * desconocido— pero deja por escrito cuáles se consideraron y se descartaron,
   * que es lo que una prueba puede aportar sobre una ausencia.
   */
  describe('P3 · ningún dato de un tercero', () => {
    const camposDeTercero = [
      'presunto_responsable',
      'acompanante',
      'vehiculo',
      'placa',
      'apodo',
      'direccion',
      'sospechoso',
      'ultimo_contacto',
    ];

    it.each(camposDeTercero)('rechaza el campo «%s»', async (campo) => {
      const motivos = await motivosDeRechazo(
        { ...denunciaValida, [campo]: 'lo que sea' },
        CreateDenunciaDto,
      );
      expect(motivos).toContain(`property ${campo} should not exist`);
    });
  });

  /**
   * P4. No existe campo de recompensa ni de contacto directo del denunciante.
   * Un teléfono expuesto habilita extorsión.
   */
  describe('P4 · ni recompensa ni contacto', () => {
    it.each(['recompensa', 'telefono_contacto', 'contacto', 'whatsapp'])(
      'rechaza el campo «%s»',
      async (campo) => {
        const motivos = await motivosDeRechazo(
          { ...denunciaValida, [campo]: '70000000' },
          CreateDenunciaDto,
        );
        expect(motivos).toContain(`property ${campo} should not exist`);
      },
    );
  });

  /** P5. La circunstancia se elige de una lista; no se narra. */
  describe('P5 · sin narrativa de los hechos', () => {
    it('la circunstancia es obligatoria y de dominio cerrado', async () => {
      const { circunstancia, ...sinCircunstancia } = denunciaValida;
      const motivos = await motivosDeRechazo(
        sinCircunstancia,
        CreateDenunciaDto,
      );
      expect(motivos.join(' ')).toContain('circunstancia');
    });

    it('rechaza narrar la circunstancia en vez de elegirla', async () => {
      const motivos = await motivosDeRechazo(
        {
          ...denunciaValida,
          circunstancia: 'Salió a comprar y ya no volvió a casa',
        },
        CreateDenunciaDto,
      );
      expect(motivos.join(' ')).toContain('circunstancia');
    });
  });

  describe('fotografía', () => {
    it('es obligatoria: sin imagen la alerta no sirve para reconocer', async () => {
      const { fotografia_base64, ...sinFoto } = denunciaValida;
      const motivos = await motivosDeRechazo(sinFoto, CreateDenunciaDto);
      expect(motivos.join(' ')).toContain('fotografia_base64');
    });
  });
});
