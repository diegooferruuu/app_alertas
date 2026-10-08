/**
 * Pruebas de las funciones puras del teléfono.
 *
 * Corren en Node, sin React Native ni Expo: lo que se prueba aquí no toca la
 * pantalla. Las pantallas no tienen pruebas automáticas; se verifican a mano en
 * el dispositivo.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', target: 'ES2020', strict: true, esModuleInterop: true } },
    ],
  },
};
