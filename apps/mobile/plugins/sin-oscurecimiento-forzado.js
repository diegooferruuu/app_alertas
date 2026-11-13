/**
 * Impide que Android oscurezca la app por su cuenta.
 *
 * La app solo tiene tema claro (`"userInterfaceStyle": "light"` en `app.json`,
 * que en Android aplica `expo-system-ui`). Pero algunos sistemas oscurecen
 * igual las apps claras: el «modo oscuro para apps» de Xiaomi (MIUI, HyperOS) y
 * de otras marcas, y el modo oscuro ampliado de Android. Lo hacen invirtiendo
 * colores a ciegas, y en los formularios dejaban el texto escrito del mismo
 * color que el fondo del campo: no se veía lo que se escribía.
 *
 * `android:forceDarkAllowed="false"` en el tema de la app es la forma de decirle
 * al sistema que no lo haga.
 */
const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

module.exports = function sinOscurecimientoForzado(config) {
  return withAndroidStyles(config, (config) => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:forceDarkAllowed',
      value: 'false',
    });
    return config;
  });
};
