/******************************************************************
 *
 * TITANIUM X
 * MARKET SERVICE
 *
 ******************************************************************/

const MarketService = {

  obtenerPrecios() {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const hoja = ss.getSheetByName(HOJAS.PRECIOS);

    if (!hoja) return [];

    return hoja.getDataRange().getValues();

  },

  obtenerCCL() {

    try {

      return obtenerCCLActual();

    } catch (e) {

      return 0;

    }

  },

  obtenerPrecioTicker(ticker) {

    const datos = this.obtenerPrecios();

    ticker = String(ticker).toUpperCase();

    for (let i = 1; i < datos.length; i++) {

      if (String(datos[i][0]).toUpperCase() === ticker) {

        return {

          ticker: ticker,

          precio: datos[i][1],

          moneda: datos[i][2]

        };

      }

    }

    return null;

  }

};