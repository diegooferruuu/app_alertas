#!/bin/zsh
# Apunta la aplicación móvil a la IP que tenga esta máquina ahora mismo.
#
#   ./tools/red-demo.sh
#
# Existe por una razón concreta: al cambiar de red —un hotspot en la
# universidad, por ejemplo— la Mac recibe otra dirección, y la que quedó escrita
# deja de existir. El síntoma no es un error claro sino la aplicación intentando
# hablar con una máquina que no está.
#
# Direcciones típicas: hotspot de iPhone reparte 172.20.10.x; el de Android,
# 192.168.43.x.
#
# Después de correrlo hay que reiniciar Expo con --clear: el valor se incrusta
# en el bundle al construirlo, así que un Metro ya arrancado sigue con el viejo.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
ENV_MOVIL="$RAIZ/apps/mobile/.env"

# Se prueba en orden: wifi primero, luego el resto. `en0` es la wifi en casi
# todos los Mac; con un iPhone por USB aparece otra interfaz distinta.
IP=""
for interfaz in en0 en1 en2 en3 en4 en5 en6 en7; do
  candidata=$(ipconfig getifaddr "$interfaz" 2>/dev/null || true)
  if [ -n "$candidata" ]; then IP="$candidata"; INTERFAZ="$interfaz"; break; fi
done

if [ -z "$IP" ]; then
  echo "✗ Esta máquina no tiene ninguna dirección de red."
  echo "  Conéctate al hotspot o a la wifi y vuelve a correrlo."
  exit 1
fi

URL="http://$IP:3000/api"

cat > "$ENV_MOVIL" <<FIN
# Generado por tools/red-demo.sh — $(date '+%Y-%m-%d %H:%M')
#
# Expo lee este archivo desde apps/mobile, no desde la raíz del repositorio.
# Tiene que ser la IP de esta máquina en la red local: \`localhost\` lo resuelve
# cada teléfono contra sí mismo. Ignorado por git: es configuración local.
EXPO_PUBLIC_API_URL=$URL
FIN

echo "✓ Interfaz $INTERFAZ → $IP"
echo "✓ apps/mobile/.env apunta a $URL"
echo

# Comprobar que la API responde ahorra descubrirlo desde el teléfono, que es
# donde peor se diagnostica.
if curl -s -o /dev/null --max-time 4 "$URL/denuncias"; then
  echo "✓ La API responde en esa dirección."
else
  echo "✗ La API NO responde en $URL"
  echo "  Arranca el backend:  cd apps/backend && pnpm start:dev"
fi

cat <<FIN

Siguiente paso — el valor se incrusta al construir el bundle, así que Metro
tiene que arrancar de nuevo tirando su caché:

  cd apps/mobile && npx expo start --dev-client --clear

  · Android (build de desarrollo): se conecta desde la propia app.
  · iPhone (Expo Go): en la terminal de Metro presiona «s» para mostrar el
    código QR de Expo Go y escanéalo. Si no carga, abre otra terminal con
      cd apps/mobile && npx expo start --go --port 8082

Y para que los teléfonos lleguen:
  · Los dos en la MISMA red que esta Mac.
  · Una cuenta distinta en cada uno: al denunciante no se le alerta de su
    propia denuncia.
FIN
