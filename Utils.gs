/******************************************************************
 *
 * TITANIUM X
 * UTILIDADES GENERALES
 *
 ******************************************************************/

function esVacio(valor) {
  return valor === null ||
         valor === undefined ||
         valor === "";
}

function redondear(numero, decimales = 2) {
  return Number(numero.toFixed(decimales));
}

function hoy() {
  return new Date();
}

function formatoFecha(fecha = new Date()) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss"
  );
}

function generarUUID() {
  return Utilities.getUuid();
}

function clonar(objeto) {
  return JSON.parse(JSON.stringify(objeto));
}
