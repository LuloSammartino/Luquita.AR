# Luquita 💸

Luquita es un asistente financiero personal que te permite registrar gastos e ingresos desde Telegram y llevar tus cuentas en Google Sheets. Podés escribirle un mensaje o mandarle una nota de voz, sin abrir la planilla cada vez que hacés una compra.

Su objetivo es hacer más fácil el hábito de anotar los movimientos del día a día y ayudarte a entender en qué se va tu plata.

## Cómo funciona

Mandás un mensaje como **“Gasté 8500 en supermercado”** o un audio diciendo **“Cargué veinte mil pesos de nafta”**. Luquita identifica el monto, la categoría y la fecha, y te muestra los datos para que los revises.

Cuando confirmás, guarda el movimiento en Google Sheets y actualiza el resumen del mes. Si hay un error de conexión, conserva la operación pendiente y vuelve a intentarlo, evitando registrar dos veces el mismo gasto.

## Qué podés hacer

- Registrar gastos e ingresos mediante texto o notas de voz.
- Clasificar movimientos en categorías como alimentación, nafta, alquiler, entretenimiento o sueldo.
- Usar la fecha del mensaje, indicar “ayer” o escribir una fecha específica.
- Confirmar o cancelar cada movimiento antes de guardarlo.
- Consultar las categorías disponibles y los registros pendientes desde Telegram.
- Revisar y corregir los movimientos guardados directamente en la planilla.

## Tus cuentas en una planilla

Google Sheets conserva el detalle de cada operación en una pestaña **Movimientos**, con su fecha, categoría, monto y descripción. El resumen mensual reúne esos importes junto con los valores que ya tenías cargados.

Así, Telegram sirve para anotar rápidamente y la planilla para consultar tus cuentas, comparar meses y analizar tus gastos. Luquita no tiene panel web.

## Audios sin una API de IA paga

Las notas de voz se transcriben con Whisper en el equipo donde corre Luquita. El audio no se envía a un proveedor externo de IA para transcribirlo y no hace falta pagar una API por cada mensaje. Telegram y Google Sheets sí requieren conexión a internet.

La interpretación utiliza reglas y categorías definidas. Puede pedirte que reformules un mensaje si encuentra datos ambiguos; por eso, siempre te muestra el resultado antes de registrarlo.

## Pensada para uso personal

Luquita acepta mensajes privados de un único usuario autorizado y trabaja con pesos argentinos. Guarda los pendientes en una cola local para poder continuar después de un reinicio o una interrupción de conexión.

Para procesar mensajes necesita estar ejecutándose en una computadora o servidor. La transcripción puede tardar según los recursos del equipo, y Telegram conserva los mensajes todavía no recibidos por el bot durante un máximo de 24 horas.

## Tecnologías

- **Node.js:** bot de Telegram, interpretación de mensajes y conexión con Google Sheets.
- **SQLite:** almacenamiento local de operaciones y reintentos.
- **Python y faster-whisper:** transcripción local de notas de voz.
- **Google Sheets:** historial de movimientos y resumen mensual.

Las credenciales y los datos financieros se mantienen fuera del repositorio.
