import { conOcultamiento, vistaPublica, vistaPublicaDe } from './vista-publica';
import { Denuncia } from './entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from './domain/estados';

const AUTOR = '11111111-1111-4111-8111-111111111111';
const OTRA_PERSONA = '22222222-2222-4222-8222-222222222222';

const denunciaDePrueba = (): Denuncia =>
  ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    denunciante_id: AUTOR,
    nombre_persona_buscada: 'Luis Mamani',
    description: 'Visto por última vez el martes',
    latitude: -16.5,
    longitude: -68.15,
    nivel_confianza: NivelConfianza.PROVISIONAL,
    estado: EstadoDenuncia.ACTIVA,
    radio_actual_m: 2000,
    expira_en: new Date(),
    prolongaciones: 0,
    created_at: new Date(),
    updated_at: new Date(),
  }) as Denuncia;

describe('Vista pública de una denuncia', () => {
  it('no expone el identificador de quien denunció', () => {
    const vista = vistaPublica(denunciaDePrueba(), OTRA_PERSONA);

    expect(vista).not.toHaveProperty('denunciante_id');
    expect(JSON.stringify(vista)).not.toContain(AUTOR);
  });

  it('tampoco al propio autor: no hace falta para nada', () => {
    const vista = vistaPublica(denunciaDePrueba(), AUTOR);

    expect(vista).not.toHaveProperty('denunciante_id');
  });

  it('dice si la denuncia es de quien la mira', () => {
    expect(vistaPublica(denunciaDePrueba(), AUTOR).es_mia).toBe(true);
    expect(vistaPublica(denunciaDePrueba(), OTRA_PERSONA).es_mia).toBe(false);
  });

  it('conserva todo lo demás, incluida la distancia de la consulta de cercanía', () => {
    const conDistancia = Object.assign(denunciaDePrueba(), {
      distance_meters: 340,
    });

    const vista = vistaPublica(conDistancia, OTRA_PERSONA);

    expect(vista.nombre_persona_buscada).toBe('Luis Mamani');
    expect(vista.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
    expect(vista.estado).toBe(EstadoDenuncia.ACTIVA);
    expect(vista.radio_actual_m).toBe(2000);
    expect((vista as { distance_meters: number }).distance_meters).toBe(340);
  });

  it('aplica lo mismo a una lista', () => {
    const ajena = Object.assign(denunciaDePrueba(), {
      denunciante_id: OTRA_PERSONA,
    });

    const vistas = vistaPublicaDe([denunciaDePrueba(), ajena], AUTOR);

    expect(vistas.map((v) => v.es_mia)).toEqual([true, false]);
    expect(JSON.stringify(vistas)).not.toContain(AUTOR);
    expect(JSON.stringify(vistas)).not.toContain(OTRA_PERSONA);
  });
});

describe('Contenido oculto tras un reporte', () => {
  const conFoto = (userId: string) => ({
    ...vistaPublica(denunciaDePrueba(), userId),
    fotografias: [{ contenido: 'foto' }],
  });

  it('a quien no la presentó le quita la foto y el relato, no el nombre', () => {
    const vista = conOcultamiento(conFoto(OTRA_PERSONA), true);

    expect(vista.fotografias).toEqual([]);
    expect(vista.description).toBeNull();
    expect(vista.nombre_persona_buscada).toBe('Luis Mamani');
    expect(vista.contenido_oculto).toBe(true);
  });

  it('a quien la presentó le deja todo y le dice que se ocultó', () => {
    const vista = conOcultamiento(conFoto(AUTOR), true);

    expect(vista.fotografias).toHaveLength(1);
    expect(vista.description).toBe('Visto por última vez el martes');
    expect(vista.contenido_oculto).toBe(true);
  });

  it('en una lista, que no trae fotos, no inventa el campo', () => {
    const vista = conOcultamiento(vistaPublica(denunciaDePrueba(), OTRA_PERSONA), true);

    expect(vista).not.toHaveProperty('fotografias');
    expect(vista.description).toBeNull();
  });

  it('sin ocultamiento no cambia nada', () => {
    const vista = conOcultamiento(conFoto(OTRA_PERSONA), false);

    expect(vista.fotografias).toHaveLength(1);
    expect(vista.contenido_oculto).toBe(false);
  });
});
