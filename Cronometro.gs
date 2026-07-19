/******************************************************************
 *
 * TITANIUM X
 * CRONÓMETRO
 *
 ******************************************************************/

const CRONOMETRO = {
  inicios: {}
};

function iniciarCronometro(nombre) {

  CRONOMETRO.inicios[nombre] = Date.now();

}

function detenerCronometro(nombre) {

  if (!(nombre in CRONOMETRO.inicios)) return 0;

  const tiempo = Date.now() - CRONOMETRO.inicios[nombre];

  delete CRONOMETRO.inicios[nombre];

  logInfo("CRONO", `${nombre} : ${tiempo} ms`);

  return tiempo;

}

function medir(nombre, funcion) {

  iniciarCronometro(nombre);

  try {

    return funcion();

  } finally {

    detenerCronometro(nombre);

  }

}
