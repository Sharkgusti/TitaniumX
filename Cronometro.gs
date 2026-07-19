/******************************************************************
 *
 * TITANIUM X
 * CRONÓMETRO
 *
 ******************************************************************/

const CRONOMETRO = {};

CRONOMETRO.inicios = {};

function iniciarCronometro(nombre) {

  CRONOMETRO.inicios[nombre] = new Date().getTime();

}

function detenerCronometro(nombre) {

  if (!CRONOMETRO.inicios[nombre]) return 0;

  const tiempo = new Date().getTime() - CRONOMETRO.inicios[nombre];

  delete CRONOMETRO.inicios[nombre];

  logInfo("CRONO", nombre + " : " + tiempo + " ms");

  return tiempo;

}

function medir(nombre, funcion) {

  iniciarCronometro(nombre);

  const resultado = funcion();

  detenerCronometro(nombre);

  return resultado;

}