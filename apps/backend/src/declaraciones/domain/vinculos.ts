/**
 * Vínculo declarado entre quien denuncia y la persona buscada.
 *
 * La lista es cerrada a propósito. Una declaración específica compromete más
 * que una vaga: «soy el padre» es falsable y contrastable, «soy allegado» no lo
 * es. Un campo de texto libre permitiría exactamente esa ambigüedad, y además
 * podría contener datos de terceros, que el invariante I3 prohíbe.
 */
export enum VinculoDeclarado {
  MADRE = 'MADRE',
  PADRE = 'PADRE',
  HIJO_A = 'HIJO_A',
  HERMANO_A = 'HERMANO_A',
  CONYUGE = 'CONYUGE',
  TUTOR_LEGAL = 'TUTOR_LEGAL',
  OTRO_FAMILIAR = 'OTRO_FAMILIAR',
  TERCERO_NO_FAMILIAR = 'TERCERO_NO_FAMILIAR',
}

/** Etiqueta legible, para insertarla en el texto legal y en la interfaz. */
export const ETIQUETA_VINCULO: Record<VinculoDeclarado, string> = {
  [VinculoDeclarado.MADRE]: 'madre',
  [VinculoDeclarado.PADRE]: 'padre',
  [VinculoDeclarado.HIJO_A]: 'hijo o hija',
  [VinculoDeclarado.HERMANO_A]: 'hermano o hermana',
  [VinculoDeclarado.CONYUGE]: 'cónyuge',
  [VinculoDeclarado.TUTOR_LEGAL]: 'tutor legal',
  [VinculoDeclarado.OTRO_FAMILIAR]: 'familiar',
  [VinculoDeclarado.TERCERO_NO_FAMILIAR]: 'persona allegada no familiar',
};

/**
 * Si el vínculo declarado entra con alcance reducido.
 *
 * `TERCERO_NO_FAMILIAR` **no bloquea la denuncia**: muchas desapariciones reales
 * las reportan compañeros de cuarto, empleadores o personal de instituciones de
 * acogida, y son justamente los casos más vulnerables. Entra con un radio menor
 * y una caducidad más corta, no con un rechazo.
 */
export const tieneAlcanceReducido = (vinculo: VinculoDeclarado): boolean =>
  vinculo === VinculoDeclarado.TERCERO_NO_FAMILIAR;

export const VINCULOS_VALIDOS = Object.values(VinculoDeclarado);
