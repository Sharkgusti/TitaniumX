/******************************************************************
 *
 * TITANIUM X
 * SHEETS
 *
 ******************************************************************/

function leerDatos(nombreHoja) {

  const sh = hoja(nombreHoja);

  if (!sh) return [];

  return sh.getDataRange().getValues();

}

function escribirDatos(nombreHoja, datos) {

  const sh = hoja(nombreHoja);

  if (!sh) return false;

  sh.clearContents();

  if (datos.length > 0) {

    sh.getRange(
      1,
      1,
      datos.length,
      datos[0].length
    ).setValues(datos);

  }

  return true;

}

function agregarFila(nombreHoja, fila) {

  const sh = hoja(nombreHoja);

  if (!sh) return false;

  sh.appendRow(fila);

  return true;

}

function limpiarHoja(nombreHoja) {

  const sh = hoja(nombreHoja);

  if (!sh) return false;

  sh.clearContents();

  return true;

}

function nombresHojas() {

  return libro()
    .getSheets()
    .map(s => s.getName());

}