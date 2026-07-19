/******************************************************************
 *
 * TITANIUM X
 * VALIDACIONES
 *
 ******************************************************************/

function esNumero(valor) {

  return !isNaN(valor) && valor !== null && valor !== "";

}

function esTexto(valor) {

  return typeof valor === "string";

}

function esFecha(valor) {

  return valor instanceof Date && !isNaN(valor);

}

function validarObligatorio(valor) {

  return valor !== null &&
         valor !== undefined &&
         valor !== "";

}

function validarTicker(ticker) {

  if (!validarObligatorio(ticker)) return false;

  return String(ticker).trim().length > 0;

}

function validarMonto(monto) {

  return esNumero(monto);

}

function validarOperacion(op) {

  return validarObligatorio(op);

}