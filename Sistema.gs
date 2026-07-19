/******************************************************************
 *
 * TITANIUM X
 * SISTEMA CENTRAL
 *
 ******************************************************************/

function sistemaIniciado() {
  return true;
}

function versionSistema() {
  return TITANIUM.VERSION;
}

function nombreSistema() {
  return TITANIUM.NOMBRE;
}

function buildSistema() {
  return TITANIUM.BUILD;
}

function estadoSistema() {

  return {

    nombre: nombreSistema(),

    version: versionSistema(),

    build: buildSistema(),

    fecha: formatoFecha(),

    modulos: listarModulos(),

    iniciado: ESTADO.iniciado,

    cache: true,

    logger: LOGGER.activo

  };

}