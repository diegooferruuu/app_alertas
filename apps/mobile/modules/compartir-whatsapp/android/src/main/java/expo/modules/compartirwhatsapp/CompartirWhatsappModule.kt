package expo.modules.compartirwhatsapp

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Abre el chat de WhatsApp de un número con una imagen y un texto adjuntos.
 *
 * Existe porque `wa.me` solo lleva texto, y el reporte de avistamiento tiene que
 * llegar como imagen, para que no se pueda editar antes de enviarlo. Compartir
 * con el menú del sistema también lleva la imagen, pero obliga a buscar el chat
 * de la Policía entre los contactos, y casi nadie lo tiene guardado.
 *
 * El número va en el extra `jid`, que WhatsApp lee aunque no lo documenta. Si
 * una versión dejara de leerlo, WhatsApp abre su selector de chats con la
 * imagen ya adjunta: se pierde el atajo, no el reporte.
 *
 * Devuelve `false` si no hay WhatsApp instalado, para que la app ofrezca el
 * menú de compartir en su lugar.
 */
class CompartirWhatsappModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CompartirWhatsapp")

    AsyncFunction("enviarImagen") { archivo: String, texto: String, numero: String ->
      val contexto = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val ruta = Uri.parse(archivo).path
        ?: throw IllegalArgumentException("La imagen del reporte no tiene ruta: $archivo")
      val imagen = FileProvider.getUriForFile(
        contexto,
        "${contexto.packageName}.ProveedorDeReportes",
        File(ruta)
      )

      // WhatsApp Business es otra aplicación, y hay quien solo tiene esa.
      for (paquete in listOf("com.whatsapp", "com.whatsapp.w4b")) {
        val intento = Intent(Intent.ACTION_SEND).apply {
          type = "image/png"
          setPackage(paquete)
          putExtra(Intent.EXTRA_STREAM, imagen)
          putExtra(Intent.EXTRA_TEXT, texto)
          putExtra("jid", "${numero.filter { it.isDigit() }}@s.whatsapp.net")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
          appContext.throwingActivity.startActivity(intento)
          return@AsyncFunction true
        } catch (sinEsta: ActivityNotFoundException) {
          // No está esta aplicación: se prueba la siguiente.
        }
      }
      false
    }
  }
}
