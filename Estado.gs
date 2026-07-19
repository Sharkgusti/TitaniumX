/******************************************************************
 *
 * TITANIUM X
 * ESTADO GLOBAL DEL SISTEMA
 *
 ******************************************************************/

const ESTADO = {

  iniciado: false,

  cargando: false,

  ultimoProceso: "",

  ultimaActualizacion: null,

  errores: 0,

  advertencias: 0,

  modoDebug: true,

  modulos: {}

};

function iniciarSistema() {

  ESTADO.iniciado = true;
  ESTADO.ultimaActualizacion = new Date();

  logInfo("SISTEMA", "Sistema iniciado");

}

function finalizarProceso(nombre) {

  ESTADO.cargando = false;
  ESTADO.ultimoProceso = nombre;
  ESTADO.ultimaActualizacion = new Date();

}

function iniciarProceso(nombre) {

  ESTADO.cargando = true;
  ESTADO.ultimoProceso = nombre;
  ESTADO.ultimaActualizacion = new Date();

  logInfo("PROCESO", "Iniciado: " + nombre);

}

function terminarProceso(nombre) {

  ESTADO.cargando = false;
  ESTADO.ultimoProceso = nombre;
  ESTADO.ultimaActualizacion = new Date();

  logInfo("PROCESO", "Finalizado: " + nombre);

}

function registrarError(error = null) {

  ESTADO.errores++;
  ESTADO.ultimaActualizacion = new Date();

  if (error) {
    logError("SISTEMA", error.stack || error.toString());
  }

}

function registrarAdvertencia() {

  ESTADO.advertencias++;
  ESTADO.ultimaActualizacion = new Date();

}

function registrarModulo(nombre) {

  ESTADO.modulos[nombre] = true;

}

function moduloActivo(nombre) {

  return ESTADO.modulos[nombre] === true;

}

function estadoActual() {

  return {

    ...ESTADO,

    modulos: { ...ESTADO.modulos }

  };

}
