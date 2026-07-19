/******************************************************************
 *
 * TITANIUM X
 * CORE
 *
 ******************************************************************/

function iniciarCore() {

  logInfo("CORE", "Iniciando Titanium X");

  inicializarTitanium();

  return apiPing();

}

function obtenerEstadoCore() {

  return {

    sistema: estadoActual(),

    diagnostico: diagnosticoSistema(),

    version: apiVersion()

  };

}

function ejecutarMotor() {

  iniciarProceso("Motor Principal");

  try {

    const datos = generarDatosMaestros();

    terminarProceso("Motor Principal");

    return datos;

  } catch (e) {

    registrarError();

    logError("CORE", e.toString());

    throw e;

  }

}

function probarSistema() {

  return {

    ping: apiPing(),

    estado: estadoActual(),

    version: apiVersion(),

    diagnostico: diagnosticoSistema()

  };

}