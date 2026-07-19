/******************************************************************
 *
 * TITANIUM X
 * CORE
 *
 ******************************************************************/

/**
 * Inicializa el sistema y valida que la API responda.
 */
function iniciarCore() {

  logInfo("CORE", "Iniciando Titanium X");

  inicializarTitanium();

  const ping = apiPing();

  if (!ping) {
    throw new Error("No fue posible inicializar Titanium.");
  }

  return ping;

}

/**
 * Devuelve el estado consolidado del núcleo.
 */
function obtenerEstadoCore() {

  return {

    sistema: estadoActual(),

    diagnostico: diagnosticoSistema(),

    version: apiVersion()

  };

}

/**
 * Ejecuta el motor principal.
 */
function ejecutarMotor() {

  iniciarProceso("Motor Principal");

  try {

    const datos = generarDatosMaestros();

    terminarProceso("Motor Principal");

    return datos;

  } catch (e) {

    registrarError(e);

    logError("CORE", e.stack || e.toString());

    throw e;

  }

}

/**
 * Test rápido de salud del sistema.
 */
function probarSistema() {

  return {

    ping: apiPing(),

    estado: estadoActual(),

    version: apiVersion(),

    diagnostico: diagnosticoSistema()

  };

}
