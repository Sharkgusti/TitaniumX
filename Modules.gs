/******************************************************************
 *
 * TITANIUM X
 * ADMINISTRADOR DE MÓDULOS
 *
 ******************************************************************/

const MODULES = {

  dashboard: true,

  cartera: true,

  caja: true,

  fiscal: true,

  auditoria: true,

  bombonera: true,

  quant: true,

  universo: true,

  ia: true,

  reportes: true

};

function moduloActivo(nombre) {

  return MODULES[nombre] === true;

}

function activarModulo(nombre) {

  MODULES[nombre] = true;

}

function desactivarModulo(nombre) {

  MODULES[nombre] = false;

}

function listarModulos() {

  return MODULES;

}
