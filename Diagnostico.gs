/******************************************************************
 *
 * TITANIUM X
 * DIAGNÓSTICO DEL SISTEMA
 *
 ******************************************************************/

function diagnosticoSistema() {

  const estado = estadoActual();

  return {

    sistema: nombreSistema(),

    version: versionSistema(),

    build: buildSistema(),

    iniciado: estado.iniciado,

    cargando: estado.cargando,

    ultimoProceso: estado.ultimoProceso,

    errores: estado.errores,

    advertencias: estado.advertencias,

    fecha: new Date(),

    modulos: Object.keys(estado.modulos)

  };

}

function imprimirDiagnostico() {

  logInfo(
    "DIAGNOSTICO",
    JSON.stringify(diagnosticoSistema())
  );

}