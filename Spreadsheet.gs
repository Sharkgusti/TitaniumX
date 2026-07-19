/******************************************************************
 *
 * TITANIUM X
 * SPREADSHEET
 *
 ******************************************************************/

function libro() {

  return SpreadsheetApp.getActiveSpreadsheet();

}

function hoja(nombre) {

  return libro().getSheetByName(nombre);

}

function existeHoja(nombre) {

  return hoja(nombre) !== null;

}

function crearHoja(nombre) {

  if (existeHoja(nombre)) {

    return hoja(nombre);

  }

  return libro().insertSheet(nombre);

}

function ultimaFila(nombre) {

  return hoja(nombre).getLastRow();

}

function ultimaColumna(nombre) {

  return hoja(nombre).getLastColumn();

}