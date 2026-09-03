import { ValidationPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';

/**
 * Estas pruebas ejercen el `ValidationPipe` con la misma configuración que el
 * servidor (`whitelist`, `forbidNonWhitelisted`, `transform`), porque el defecto
 * que arreglan solo aparecía ahí: un inicializador `= ''` en el DTO compila a una
 * asignación real, y con `transform` la instancia acababa cargando propiedades
 * fantasma que `forbidNonWhitelisted` rechazaba. Un cuerpo intachable devolvía
 * 400. Un DTO sin decoradores lo agravaba: toda propiedad quedaba fuera de la
 * lista blanca.
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

/**
 * Los motivos concretos («… should not exist») viven en la respuesta de la
 * excepción, no en su `.message`, que es el genérico «Bad Request Exception».
 * Este ayudante devuelve esa lista para poder afirmar sobre ella.
 */
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

const registroValido = {
  email: 'ana@example.com',
  password: 'Password1',
  full_name: 'Ana Quispe',
  phone: '70000000',
};

describe('RegisterDto', () => {
  it('acepta un cuerpo completo y válido', async () => {
    const salida = await pipe.transform({ ...registroValido }, comoBody(RegisterDto));
    expect(salida).toBeInstanceOf(RegisterDto);
    expect(salida.email).toBe('ana@example.com');
  });

  it('no deja propiedades fantasma en la instancia: solo lo que entró', async () => {
    // El corazón del defecto. Antes, la instancia transformada arrastraba los
    // valores por defecto de los inicializadores aunque el cuerpo no los trajera.
    const salida = await pipe.transform({ ...registroValido }, comoBody(RegisterDto));
    expect(Object.keys(salida).sort()).toEqual(
      ['email', 'full_name', 'password', 'phone'].sort(),
    );
  });

  it('rechaza un cuerpo vacío en lugar de aceptarlo en silencio', async () => {
    await expect(pipe.transform({}, comoBody(RegisterDto))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza si falta un campo obligatorio', async () => {
    const { phone: _omitido, ...sinTelefono } = registroValido;
    await expect(
      pipe.transform(sinTelefono, comoBody(RegisterDto)),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una propiedad desconocida: es la barrera contra escalar privilegios', async () => {
    const motivos = await motivosDeRechazo(
      { ...registroValido, role: 'admin' },
      RegisterDto,
    );
    expect(motivos).toContain('property role should not exist');
  });

  it('rechaza el antiguo id_card_base64, que ya no forma parte del registro', async () => {
    const motivos = await motivosDeRechazo(
      { ...registroValido, id_card_base64: 'ABC' },
      RegisterDto,
    );
    expect(motivos).toContain('property id_card_base64 should not exist');
  });

  it('rechaza una contraseña sin mayúscula, minúscula y dígito', async () => {
    await expect(
      pipe.transform(
        { ...registroValido, password: 'todominuscula' },
        comoBody(RegisterDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('LoginDto', () => {
  it('acepta credenciales válidas', async () => {
    const salida = await pipe.transform(
      { email: 'ana@example.com', password: 'Password1' },
      comoBody(LoginDto),
    );
    expect(salida).toBeInstanceOf(LoginDto);
  });

  it('rechaza una propiedad desconocida', async () => {
    const motivos = await motivosDeRechazo(
      { email: 'ana@example.com', password: 'Password1', extra: 1 },
      LoginDto,
    );
    expect(motivos).toContain('property extra should not exist');
  });

  it('rechaza un correo mal formado', async () => {
    await expect(
      pipe.transform(
        { email: 'no-es-correo', password: 'Password1' },
        comoBody(LoginDto),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
