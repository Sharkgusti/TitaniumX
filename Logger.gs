/******************************************************************
 *
 * TITANIUM X
 * LOGGER CENTRAL
 *
 ******************************************************************/

const LOGGER = {

  activo: true,

  mostrarConsola: true,

  maxHistorial: 1000,

  historial: []

};

function logInfo(modulo, mensaje) {

  registrarLog("INFO", modulo, mensaje);

}

function logWarn(modulo, mensaje) {

  registrarLog("WARN", modulo, mensaje);

}

function logError(modulo, mensaje) {

  registrarLog("ERROR", modulo, mensaje);

}

function registrarLog(nivel, modulo, mensaje) {

  if (!LOGGER.activo) return;

  const registro = {

    fecha: new Date(),

    nivel,

    modulo,

    mensaje: String(mensaje)

  };

  LOGGER.historial.push(registro);

  if (LOGGER.historial.length > LOGGER.maxHistorial) {
    LOGGER.historial.shift();
  }

  const texto =
    "[" +
    Utilities.formatDate(
      registro.fecha,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss"
    ) +
    "] [" +
    nivel +
    "] [" +
    modulo +
    "] " +
    registro.mensaje;

  if (LOGGER.mostrarConsola) {

    console.log(texto);

  }

}

function obtenerLogs() {

  return [...LOGGER.historial];

}

function limpiarLogs() {

  LOGGER.historial.length = 0;

}
