import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FichasController } from './fichas.controller';
import { DenunciasService } from './denuncias.service';
import { Denuncia } from './entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from './domain/estados';

const ID = '5c3f0d7e-1111-4a2b-9c3d-123456789abc';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

/** La denuncia que devuelve el servicio cuando la ficha se puede mostrar. */
const visible = (cambios: Partial<Denuncia> = {}): Partial<Denuncia> => ({
  id: ID,
  nombre_persona_buscada: 'Rosa Vargas',
  estado: EstadoDenuncia.ACTIVA,
  nivel_confianza: NivelConfianza.PROVISIONAL,
  expira_en: new Date(Date.now() + 3_600_000),
  fecha_nacimiento: '1962-05-14',
  sexo: 'FEMENINO',
  estatura_rango: null,
  contextura: null,
  color_piel: null,
  color_cabello: null,
  color_ojos: null,
  senas_particulares: null,
  prenda_superior: null,
  color_prenda_superior: null,
  prenda_inferior: null,
  color_prenda_inferior: null,
  calzado: null,
  condicion_relevante: null,
  circunstancia: null,
  ultimo_avistamiento_en: null,
  latitude: -17.385,
  longitude: -66.155,
  ...cambios,
});

/** El servicio, con la denuncia que «existe» y sus fotos. Sin denuncia, todo es «no encontrada». */
const servicio = (denuncia: object | null, fotos: Buffer[] = []) => ({
  fichaPublica: jest.fn(async () => {
    if (!denuncia) throw new NotFoundException('Denuncia no encontrada');
    return denuncia;
  }),
  fotografiasDe: jest.fn(async () => fotos.map((f) => ({ contenido: f.toString('base64') }))),
});

/** Una respuesta de Express mínima que anota lo que se le hizo. */
const respuesta = () => {
  const r = {
    estado: 0,
    tipo: '',
    cabeceras: {} as Record<string, string>,
    cuerpo: undefined as unknown,
    set(c: Record<string, string>) {
      Object.assign(r.cabeceras, c);
      return r;
    },
    status(s: number) {
      r.estado = s;
      return r;
    },
    type(t: string) {
      r.tipo = t;
      return r;
    },
    send(b: unknown) {
      r.cuerpo = b;
      return r;
    },
    end() {
      return r;
    },
  };
  return r;
};

const peticion = (id: string) =>
  ({ protocol: 'http', get: () => '172.20.10.10:3000', originalUrl: `/api/fichas/${id}` }) as any;

const controlador = (s: ReturnType<typeof servicio>) =>
  new FichasController(s as unknown as DenunciasService);

const abrirFicha = async (s: ReturnType<typeof servicio>, id = ID) => {
  const res = respuesta();
  await controlador(s).ficha(id, peticion(id), res as any);
  return res;
};

const pedirFoto = async (s: ReturnType<typeof servicio>, id = ID) => {
  const res = respuesta();
  await controlador(s).foto(id, res as any);
  return res;
};

describe('FichasController', () => {
  it('se abre sin sesión: es el único controlador sin guard', () => {
    // Lo abre la Policía desde un enlace, sin la aplicación.
    expect(Reflect.getMetadata(GUARDS_METADATA, FichasController)).toBeUndefined();
    for (const metodo of ['ficha', 'foto'] as const) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, FichasController.prototype[metodo]),
      ).toBeUndefined();
    }
  });

  it('muestra la ficha de una alerta visible y anuncia su foto con la dirección completa', async () => {
    const res = await abrirFicha(servicio(visible(), [JPEG]));

    expect(res.estado).toBe(200);
    expect(res.tipo).toBe('html');
    expect(res.cuerpo).toContain(
      `<meta property="og:image" content="http://172.20.10.10:3000/api/fichas/${ID}/foto">`,
    );
  });

  it('toda respuesta pide no guardarse ni indexarse, y la página no ejecuta nada', async () => {
    const ficha = await abrirFicha(servicio(visible(), [JPEG]));
    const foto = await pedirFoto(servicio(visible(), [JPEG]));
    const ausente = await abrirFicha(servicio(null));

    for (const res of [ficha, foto, ausente]) {
      expect(res.cabeceras['Cache-Control']).toBe('no-store');
      expect(res.cabeceras['X-Robots-Tag']).toBe('noindex, nofollow');
    }
    expect(ficha.cabeceras['Content-Security-Policy']).toContain("default-src 'none'");
  });

  it('una alerta oculta, una inexistente y un enlace mal formado reciben la misma página', async () => {
    // Distinguirlas dejaría sondear qué enlaces esconden una denuncia.
    const oculta = await abrirFicha(servicio(null));
    const malFormada = servicio(visible());
    const mal = await abrirFicha(malFormada, 'no-es-un-identificador');

    expect(oculta.estado).toBe(404);
    expect(mal.estado).toBe(404);
    expect(mal.cuerpo).toEqual(oculta.cuerpo);
    expect(malFormada.fichaPublica).not.toHaveBeenCalled();
  });

  it('sirve la foto con su tipo real', async () => {
    const res = await pedirFoto(servicio(visible(), [JPEG]));

    expect(res.estado).toBe(200);
    expect(res.tipo).toBe('image/jpeg');
    expect(res.cuerpo).toEqual(JPEG);
  });

  it('no sirve la foto de un menor aunque exista', async () => {
    const menor = visible({ fecha_nacimiento: '2016-03-01' });

    expect((await pedirFoto(servicio(menor, [JPEG]))).estado).toBe(404);
    expect((await abrirFicha(servicio(menor, [JPEG]))).cuerpo).not.toContain('og:image');
  });

  it('un contenido que no es imagen cuenta como «sin foto»', async () => {
    const texto = Buffer.from('foto-de-demostracion');

    expect((await pedirFoto(servicio(visible(), [texto]))).estado).toBe(404);
    expect((await abrirFicha(servicio(visible(), [texto]))).cuerpo).not.toContain('og:image');
  });

  it('una alerta oculta tampoco entrega su foto', async () => {
    expect((await pedirFoto(servicio(null, [JPEG]))).estado).toBe(404);
  });

  it('un fallo que no es «no encontrada» no se disfraza de ficha retirada', async () => {
    const roto = servicio(visible());
    roto.fichaPublica.mockRejectedValueOnce(new Error('la base no responde'));

    await expect(abrirFicha(roto)).rejects.toThrow('la base no responde');
  });
});
