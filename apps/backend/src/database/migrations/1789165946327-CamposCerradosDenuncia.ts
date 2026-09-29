import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * El formulario de denuncia pasa de un relato libre a campos de dominio cerrado.
 *
 * Las columnas nuevas son nulas y las denuncias existentes no se tocan: no hay
 * de dónde sacar la estatura o la ropa de una denuncia ya presentada, y
 * rellenarlas sería inventar. La obligatoriedad vive en el DTO, que es donde
 * puede exigirse a lo nuevo sin romper lo viejo.
 *
 * `description` deja de ser obligatoria pero **no se borra**: su contenido está
 * sellado en el hash de las denuncias ya firmadas, y eliminarla volvería
 * inverificables constancias ya emitidas. Las denuncias nuevas la dejan nula y
 * se sellan con `version_formula_contenido = 2`, que no la incluye; las
 * anteriores conservan la 1.
 *
 * Revertir esto fallará en cuanto exista una denuncia del formato nuevo, porque
 * `description` no puede volver a ser NOT NULL. Es deliberado: la vuelta atrás
 * tendría que decidir primero qué hacer con esas filas.
 */
export class CamposCerradosDenuncia1789165946327 implements MigrationInterface {
    name = 'CamposCerradosDenuncia1789165946327'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "version_formula_contenido" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "fecha_nacimiento" date`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "sexo" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "estatura_rango" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "contextura" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "color_piel" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "color_cabello" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "color_ojos" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "senas_particulares" character varying(15) array`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "ultimo_avistamiento_en" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "prenda_superior" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "color_prenda_superior" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "prenda_inferior" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "color_prenda_inferior" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "calzado" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "circunstancia" character varying(40)`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "condicion_relevante" character varying(30) array`);
        await queryRunner.query(`ALTER TABLE "denuncias" ALTER COLUMN "description" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_nacimiento_antes_de_avistamiento" CHECK (((fecha_nacimiento IS NULL) OR (ultimo_avistamiento_en IS NULL) OR (fecha_nacimiento <= (ultimo_avistamiento_en)::date)))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_condicion_relevante" CHECK (((condicion_relevante IS NULL) OR (condicion_relevante <@ (ARRAY['REQUIERE_MEDICACION'::character varying, 'DIFICULTAD_DE_ORIENTACION'::character varying, 'MOVILIDAD_REDUCIDA'::character varying])::character varying[])))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_senas_particulares" CHECK (((senas_particulares IS NULL) OR (senas_particulares <@ (ARRAY['CICATRIZ'::character varying, 'TATUAJE'::character varying, 'LENTES'::character varying, 'PROTESIS'::character varying, 'LUNAR_VISIBLE'::character varying, 'OTRA'::character varying])::character varying[])))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_circunstancia" CHECK (((circunstancia IS NULL) OR ((circunstancia)::text = ANY ((ARRAY['SALIO_DE_CASA'::character varying, 'NO_LLEGO_A_DESTINO'::character varying, 'PERDIDA_DE_CONTACTO'::character varying, 'NO_REGRESO_DE_TRABAJO_O_ESTUDIO'::character varying, 'EXTRAVIO_EN_VIA_PUBLICA'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_calzado" CHECK (((calzado IS NULL) OR ((calzado)::text = ANY ((ARRAY['ZAPATILLAS'::character varying, 'ZAPATOS'::character varying, 'SANDALIAS'::character varying, 'BOTAS'::character varying, 'OJOTAS'::character varying, 'DESCALZO'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_color_prenda_inferior" CHECK (((color_prenda_inferior IS NULL) OR ((color_prenda_inferior)::text = ANY ((ARRAY['BLANCO'::character varying, 'NEGRO'::character varying, 'GRIS'::character varying, 'AZUL'::character varying, 'CELESTE'::character varying, 'ROJO'::character varying, 'VERDE'::character varying, 'AMARILLO'::character varying, 'NARANJA'::character varying, 'CAFE'::character varying, 'ROSADO'::character varying, 'MORADO'::character varying, 'BEIGE'::character varying, 'MULTICOLOR'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_color_prenda_superior" CHECK (((color_prenda_superior IS NULL) OR ((color_prenda_superior)::text = ANY ((ARRAY['BLANCO'::character varying, 'NEGRO'::character varying, 'GRIS'::character varying, 'AZUL'::character varying, 'CELESTE'::character varying, 'ROJO'::character varying, 'VERDE'::character varying, 'AMARILLO'::character varying, 'NARANJA'::character varying, 'CAFE'::character varying, 'ROSADO'::character varying, 'MORADO'::character varying, 'BEIGE'::character varying, 'MULTICOLOR'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_prenda_inferior" CHECK (((prenda_inferior IS NULL) OR ((prenda_inferior)::text = ANY ((ARRAY['PANTALON_JEAN'::character varying, 'PANTALON_TELA'::character varying, 'PANTALON_DEPORTIVO'::character varying, 'SHORT'::character varying, 'FALDA'::character varying, 'POLLERA'::character varying, 'VESTIDO_LARGO'::character varying, 'OTRA'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_prenda_superior" CHECK (((prenda_superior IS NULL) OR ((prenda_superior)::text = ANY ((ARRAY['POLERA'::character varying, 'CAMISA'::character varying, 'BLUSA'::character varying, 'CHOMPA'::character varying, 'CASACA'::character varying, 'CHAQUETA'::character varying, 'ABRIGO'::character varying, 'POLERON'::character varying, 'VESTIDO'::character varying, 'AGUAYO'::character varying, 'OTRA'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_color_ojos" CHECK (((color_ojos IS NULL) OR ((color_ojos)::text = ANY ((ARRAY['NEGROS'::character varying, 'CAFES_OSCUROS'::character varying, 'CAFES_CLAROS'::character varying, 'VERDES'::character varying, 'AZULES'::character varying, 'GRISES'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_color_cabello" CHECK (((color_cabello IS NULL) OR ((color_cabello)::text = ANY ((ARRAY['NEGRO'::character varying, 'CASTANO_OSCURO'::character varying, 'CASTANO_CLARO'::character varying, 'RUBIO'::character varying, 'ROJIZO'::character varying, 'CANOSO'::character varying, 'TENIDO'::character varying, 'SIN_CABELLO'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_color_piel" CHECK (((color_piel IS NULL) OR ((color_piel)::text = ANY ((ARRAY['CLARA'::character varying, 'TRIGUENA'::character varying, 'MORENA'::character varying, 'OSCURA'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_contextura" CHECK (((contextura IS NULL) OR ((contextura)::text = ANY ((ARRAY['DELGADA'::character varying, 'MEDIA'::character varying, 'GRUESA'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_estatura_rango" CHECK (((estatura_rango IS NULL) OR ((estatura_rango)::text = ANY ((ARRAY['MENOS_150'::character varying, 'DE_150_A_160'::character varying, 'DE_160_A_170'::character varying, 'DE_170_A_180'::character varying, 'MAS_180'::character varying])::text[]))))`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_sexo" CHECK (((sexo IS NULL) OR ((sexo)::text = ANY ((ARRAY['FEMENINO'::character varying, 'MASCULINO'::character varying, 'OTRO'::character varying])::text[]))))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_sexo"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_estatura_rango"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_contextura"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_color_piel"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_color_cabello"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_color_ojos"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_prenda_superior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_prenda_inferior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_color_prenda_superior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_color_prenda_inferior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_calzado"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_circunstancia"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_senas_particulares"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_condicion_relevante"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_nacimiento_antes_de_avistamiento"`);
        await queryRunner.query(`ALTER TABLE "denuncias" ALTER COLUMN "description" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "condicion_relevante"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "circunstancia"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "calzado"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "color_prenda_inferior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "prenda_inferior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "color_prenda_superior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "prenda_superior"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "ultimo_avistamiento_en"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "senas_particulares"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "color_ojos"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "color_cabello"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "color_piel"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "contextura"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "estatura_rango"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "sexo"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "fecha_nacimiento"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "version_formula_contenido"`);
    }

}
