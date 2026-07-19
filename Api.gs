/******************************************************************
 *
 * TITANIUM X
 * API CENTRAL
 *
 ******************************************************************/

function apiEstado() {

  return estadoActual();

}

function apiVersion() {

  return {

    nombre: nombreSistema(),

    version: versionSistema(),

    build: buildSistema()

  };

}

function apiDiagnostico() {

  return diagnosticoSistema();

}

function apiPing() {

  return {

    ok: true,

    servidor: "Titanium X",

    fecha: new Date()

  };

}

function apiInicializar() {

  return inicializarTitanium();

}