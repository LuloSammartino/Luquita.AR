# Luquita

Asistente financiero personal por Telegram, sin panel web. Node.js 24+, SQLite para la cola local, Google Sheets para los movimientos y Python/faster-whisper para transcribir audios en CPU. No utiliza servicios externos de IA ni requiere una clave de IA.

## Preparación

1. Instalá Node.js 24 o superior. Ejecutá `npm install`.
2. Copiá `.env.example` a `.env` (PowerShell: `Copy-Item .env.example .env`).
3. En Telegram, abrí **@BotFather**, ejecutá `/newbot` y agregá el token a `TELEGRAM_BOT_TOKEN`.
4. Mandale `/start` a tu nuevo bot. Ejecutá `npm run check` y copiá tu identificador numérico en `TELEGRAM_USER_ID`. No ejecutes este diagnóstico mientras el bot esté corriendo.
5. En Google Cloud, creá un proyecto, habilitá **Google Sheets API**, creá una cuenta de servicio y descargá una clave JSON. Guardala como `credentials.json` en la raíz (o configurá otra ruta).
6. Compartí tu planilla con el `client_email` del JSON como **Editor**. No hace falta hacerla pública. No compartas tu contraseña de Google.
7. Ejecutá nuevamente `npm run check`: lista las pestañas sin modificar nada. Configurá `SUMMARY_SHEET` con el nombre exacto del resumen. La planilla enlazada ya está configurada en `.env.example`.
8. Para audios, instalá Python 3.10+ y ejecutá:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

En `.env`, usá `PYTHON_BIN=.venv/Scripts/python.exe`. Para empezar solamente con texto: `ENABLE_AUDIO=false`.

9. Ejecutá `npm test` y después `npm start`.

## Uso

- `8500 supermercado`
- `Gasté veinte mil pesos en nafta`
- `500000 sueldo`
- `3500 higiene 14/11/2026`
- Audio con un solo movimiento, hasta 3 minutos / 20 MB.
- `/categorias`, `/pendientes`, `/ayuda`.

Luquita interpreta y pide **Confirmar** o **Cancelar**. Solo registra después de confirmar. Si no entiende el monto o la categoría, pide reenviar el mensaje corregido. Acepta ARS; toma la fecha original del mensaje en Argentina, aunque se procese más tarde. Podés indicar “ayer” o DD/MM/AAAA. Los números hablados tienen soporte básico, no comprensión general de lenguaje: revisá siempre la confirmación, especialmente al dictar decimales.

## Cómo modifica tu planilla

La primera operación confirmada crea la pestaña **Movimientos** (ID, fecha, mes, tipo, categoría, monto, moneda, descripción) y conecta el resumen a ella. Conserva los importes y fórmulas anteriores como base: `=(importe anterior)+SUMIFS(...)`. No cambia formatos ni categorías existentes. Se espera tu estructura actual: categorías en A, meses enero–diciembre en B:M y el año en el título. Detecta la fila de meses aunque haya filas vacías arriba.

Antes de cambiar fórmulas guarda una copia de los valores/fórmulas de A1:M100 en `data/resumen-backup-*.json`. Es un respaldo de ese rango, no una copia completa del archivo. Es recomendable duplicar también la hoja antes de la primera puesta en marcha. Si hay importes guardados como texto, detiene la conexión para que los conviertas a números.

Los totales del resumen dependen de sus fórmulas existentes. No se reparan totales manuales o fórmulas que ya estuvieran incorrectas. El año queda limitado a `SUMMARY_YEAR` para evitar cargar gastos en el año equivocado.

Para corregir una operación ya guardada, editá el monto/categoría/fecha/mes de su fila en **Movimientos**; el resumen recalcula. Para anularla, dejá su monto en 0. Conservá el ID: evita duplicados. No edites manualmente las celdas vinculadas del resumen porque quitarías su fórmula. No hay comando de deshacer todavía.

## Persistencia y operación

Los mensajes autorizados se guardan en SQLite antes de confirmar su recepción a Telegram. Los errores de conexión o transcripción reintentan con espera progresiva de hasta 5 minutos. `/pendientes` permite ver operaciones en espera. La confirmación de guardado se envía cuando Sheets responde correctamente. Una caída durante el envío puede repetir una respuesta de Telegram; el registro en Sheets se comprueba por ID antes de cada reintento.

Ejecutá **una sola instancia** del bot y no ordenes/eliminés IDs de Movimientos durante una escritura. Conservá `data/` en un disco persistente y respaldalo: contiene cola, transcripciones y mensajes financieros. No subas `.env`, claves o `data/` al repositorio. Si se pierde el disco, se pierde la cola aún no enviada; los movimientos ya guardados permanecen en Google Sheets.

La computadora debe estar encendida para procesar. Telegram retiene actualizaciones pendientes como máximo 24 horas; no sirve dejarla apagada varios días si esperás recuperar todos los mensajes. En hosting usá un proceso continuo con almacenamiento persistente (no un servicio que duerma por falta de tráfico HTTP). No necesita dominio ni puerto público. Detené con Ctrl+C; puede tardar hasta que termine la descarga/transcripción actual.

Whisper descarga el modelo la primera vez; luego transcribe localmente desde caché. Telegram y Google siguen usando internet. `base` es el modelo inicial; `tiny` consume menos recursos y puede equivocarse más. Probá audios reales antes de elegir el hosting. Si faltan Python o dependencias, los audios quedan pendientes y se reintentan hasta corregir la instalación.

## Validación

`npm test` verifica importes, categorías, fechas, autorización, persistencia, fórmulas y deduplicación después de una escritura con respuesta perdida. `npm run check` comprueba acceso real sin editar la planilla. La prueba completa requiere tus credenciales y un audio real.
