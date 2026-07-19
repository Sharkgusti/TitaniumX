/******************************************************************
 *
 * TITANIUM X
 * INICIALIZACIÓN
 *
 ******************************************************************/

function inicializarTitanium() {

  iniciarSistema();

  registrarModulo("Core");
  registrarModulo("API");
  registrarModulo("Sheets");
  registrarModulo("Eventos");
  registrarModulo("Cache");
  registrarModulo("Seguridad");

  logInfo("SISTEMA", "Titanium X inicializado");

  return estadoActual();

}

function reiniciarTitanium() {

  limpiarLogs();

  EVENTOS.limpiar();

  inicializarTitanium();

}