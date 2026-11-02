package expo.modules.compartirwhatsapp

import androidx.core.content.FileProvider

/**
 * Subclase vacía a propósito: dos `<provider>` con la misma clase chocan al
 * fusionar los manifiestos, y otras bibliotecas ya declaran `FileProvider`.
 */
class ProveedorDeReportes : FileProvider()
