/******************************************************************
 *
 * TITANIUM X
 * PROPIEDADES DEL SISTEMA
 *
 ******************************************************************/

function propiedades() {

  return PropertiesService.getScriptProperties();

}

function propiedadGuardar(clave, valor) {

  propiedades().setProperty(
    clave,
    JSON.stringify(valor)
  );

}

function propiedadLeer(clave) {

  const dato = propiedades().getProperty(clave);

  if (!dato) return null;

  try {

    return JSON.parse(dato);

  } catch (e) {

    return dato;

  }

}

function propiedadEliminar(clave) {

  propiedades().deleteProperty(clave);

}

function listarPropiedades() {

  return propiedades().getProperties();

}