/******************************************************************
 *
 * TITANIUM X
 * CACHE CENTRAL
 *
 ******************************************************************/

const CACHE = CacheService.getScriptCache();

function cacheGuardar(clave, valor, minutos = 10) {

  try {

    CACHE.put(
      clave,
      JSON.stringify(valor),
      minutos * 60
    );

    return true;

  } catch (e) {

    logError("CACHE", e.toString());
    return false;

  }

}

function cacheLeer(clave) {

  try {

    const dato = CACHE.get(clave);

    if (!dato) return null;

    return JSON.parse(dato);

  } catch (e) {

    return null;

  }

}

function cacheEliminar(clave) {

  CACHE.remove(clave);

}

function cacheExiste(clave) {

  return CACHE.get(clave) !== null;

}

function cacheLimpiar() {

  // Apps Script no permite vaciar todo el ScriptCache.
  // Se deja preparado para futuras versiones.

  logInfo("CACHE", "Limpieza solicitada");

}