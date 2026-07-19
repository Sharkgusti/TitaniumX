/******************************************************************
 *
 * TITANIUM X
 * LOGGER CENTRAL
 *
 ******************************************************************/

const LOGGER = {

  activo: true,

  mostrarConsola: true,

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

    nivel: nivel,

    modulo: modulo,

    mensaje: mensaje

  };

  LOGGER.historial.push(registro);

  const texto =
    "[" + nivel + "] [" + modulo + "] " + mensaje;

  if (LOGGER.mostrarConsola) {

    console.log(texto);

  }

}

function obtenerLogs() {

  return LOGGER.historial;

}

function limpiarLogs() {

  LOGGER.historial = [];

}