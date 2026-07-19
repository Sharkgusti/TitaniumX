/******************************************************************
 *
 * TITANIUM X
 * PERMISOS
 *
 ******************************************************************/

const PERMISOS = {

  ADMIN: "ADMIN",

  USER: "USER",

  INVITADO: "INVITADO"

};

function obtenerRolActual() {

  // Por ahora todo el sistema funciona como administrador.
  // Más adelante conectaremos usuarios reales.

  return PERMISOS.ADMIN;

}

function esAdministrador() {

  return obtenerRolActual() === PERMISOS.ADMIN;

}

function validarPermiso(rol) {

  return obtenerRolActual() === rol;

}