/******************************************************************
 *
 * TITANIUM X
 * SEGURIDAD
 *
 ******************************************************************/

const SEGURIDAD = {

  modoSeguro: true,

  sesiones: {}

};

function validarSistema() {

  return true;

}

function validarUsuario() {

  return true;

}

function iniciarSesion(usuario = "ADMIN") {

  SEGURIDAD.sesiones[usuario] = {

    inicio: new Date(),

    activo: true

  };

  logInfo("SEGURIDAD", "Sesión iniciada: " + usuario);

}

function cerrarSesion(usuario = "ADMIN") {

  if (SEGURIDAD.sesiones[usuario]) {

    SEGURIDAD.sesiones[usuario].activo = false;

  }

  logInfo("SEGURIDAD", "Sesión finalizada: " + usuario);

}

function sesionesActivas() {

  return SEGURIDAD.sesiones;

}
