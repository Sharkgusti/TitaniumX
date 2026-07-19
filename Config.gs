/******************************************************************
 *
 * TITANIUM X
 * CONFIGURACIÓN CENTRAL
 *
 ******************************************************************/

const TITANIUM = Object.freeze({

  VERSION: "X 1.0",

  BUILD: "2026.07.19",

  NOMBRE: "Titanium X",

  DEBUG: true,

  LOGS: true,

  CACHE: true,

  TEMA: "BOCA",

  TIMEZONE: "America/Argentina/Buenos_Aires",

  MONEDA_BASE: "USD",

  IDIOMA: "es-AR"

});

/**
 * Devuelve una copia inmutable de la configuración.
 */
function obtenerConfig() {
  return { ...TITANIUM };
}

/**
 * Indica si el sistema corre en modo debug.
 */
function esDebug() {
  return TITANIUM.DEBUG === true;
}

/**
 * Indica si el cache está habilitado.
 */
function cacheHabilitado() {
  return TITANIUM.CACHE === true;
}

/**
 * Indica si el log está habilitado.
 */
function logsHabilitados() {
  return TITANIUM.LOGS === true;
}
