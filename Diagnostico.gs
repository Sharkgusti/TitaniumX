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

    modulos: Object.keys(estado.modulos).sort(),

    memoria: Session.getTemporaryActiveUserKey
      ? "OK"
      : "N/D"

  };

}

function imprimirDiagnostico() {

  const diag = diagnosticoSistema();

  logInfo(
    "DIAGNOSTICO",
    JSON.stringify(diag, null, 2)
  );

  return diag;

}
