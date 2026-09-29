import { Denuncia } from './entities/denuncia.entity';

/**
 * Una denuncia tal como puede verla alguien que no la firmó.
 *
 * `denunciante_id` no aparece. Parece un dato inocuo —es un identificador, no
 * un nombre— pero es el primer eslabón de una cadena corta: el aviso que recibe
 * la persona reportada lleva el `denuncia_id`, de ahí salía el identificador de
 * quien denunció, y de ahí su ficha. Con eso, la promesa de informar sin
 * revelar al denunciante (invariante I8) quedaba en nada.
 *
 * En su lugar va `es_mia`, que es lo único que la aplicación necesitaba de ese
 * campo: saber si mostrar los controles de edición.
 */
export type DenunciaPublica = Omit<Denuncia, 'denunciante_id' | 'denunciante'> & {
  es_mia: boolean;
};

export function vistaPublica<T extends Denuncia>(
  denuncia: T,
  userId: string,
): Omit<T, 'denunciante_id' | 'denunciante'> & { es_mia: boolean } {
  const { denunciante_id, denunciante, ...resto } = denuncia;
  return { ...resto, es_mia: denunciante_id === userId };
}

export const vistaPublicaDe = <T extends Denuncia>(
  denuncias: T[],
  userId: string,
) => denuncias.map((d) => vistaPublica(d, userId));
