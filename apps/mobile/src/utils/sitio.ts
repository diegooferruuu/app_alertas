/**
 * Una página pública del servidor a partir de la dirección de la API.
 *
 * La política de privacidad y la de eliminar la cuenta viven en la raíz del
 * sitio y no bajo `/api`: son las direcciones que se publican en Google Play, y
 * se abren en el navegador, sin sesión.
 */
export type PaginaPublica = 'privacidad' | 'eliminar-cuenta';

export const paginaPublica = (urlDeLaApi: string, pagina: PaginaPublica): string =>
  `${urlDeLaApi.replace(/\/+$/, '').replace(/\/api$/, '')}/${pagina}`;
