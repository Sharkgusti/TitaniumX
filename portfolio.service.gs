/******************************************************************
 *
 * TITANIUM X
 * PORTFOLIO SERVICE
 *
 ******************************************************************/

const PortfolioService = {

  obtenerResumen() {

    return JSON.parse(generarDatosMaestros());

  },

  obtenerKPIs() {

    return this.obtenerResumen().kpis;

  },

  obtenerCartera() {

    return this.obtenerResumen().carteraDetallada;

  },

  obtenerDistribucion() {

    return this.obtenerResumen().distribucionTipos;

  },

  obtenerMejoresPosiciones() {

    return this.obtenerResumen().mejoresPosiciones;

  }

};