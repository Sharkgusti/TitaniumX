/******************************************************************
 *
 * TITANIUM X
 * EVENTOS CENTRAL
 *
 ******************************************************************/

const EVENTOS = {

  lista: []

};

EVENTOS.registrar = function(nombre, datos = {}) {

  const evento = {

    nombre: nombre,

    fecha: new Date(),

    datos: datos

  };

  EVENTOS.lista.push(evento);

  logInfo("EVENTO", nombre);

  return evento;

};

EVENTOS.disparar = function(nombre, datos = {}) {

  return EVENTOS.registrar(nombre, datos);

};

EVENTOS.obtener = function() {

  return EVENTOS.lista;

};

EVENTOS.limpiar = function() {

  EVENTOS.lista = [];

};