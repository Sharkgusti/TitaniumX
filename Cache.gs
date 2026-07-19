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
      String(clave),
      JSON.stringify(valor),
      Math.max(1, minutos) * 60
    );

    return true;

  } catch (e) {

    logError("CACHE", e.stack || e.toString());

    return false;

  }

}

function cacheLeer(clave) {

  try {

    const dato = CACHE.get(String(clave));

    if (dato === null) return null;

    return JSON.parse(dato);

  } catch (e) {

    logError("CACHE", e.stack || e.toString());

    return null;

  }

}

function cacheEliminar(clave) {

  try {

    CACHE.remove(String(clave));

    return true;

  } catch (e) {

    logError("CACHE", e.stack || e.toString());

    return false;

  }

}

function cacheExiste(clave) {

  return CACHE.get(String(clave)) !== null;

}

function cacheLimpiar() {

  // Apps Script no permite vaciar completamente ScriptCache.

  logInfo("CACHE", "Limpieza solicitada");

}
