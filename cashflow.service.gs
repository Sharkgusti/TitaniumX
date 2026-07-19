/******************************************************************
 *
 * TITANIUM X
 * CASHFLOW SERVICE
 *
 ******************************************************************/

const CashflowService = {

  obtenerProyecciones() {

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const hoja = ss.getSheetByName(HOJAS.PROY);

    if (!hoja) return [];

    const datos = hoja.getDataRange().getValues();

    return datos.slice(1);

  },

  obtenerProximoPago() {

    const resumen = JSON.parse(generarDatosMaestros());

    return resumen.kpis.nextPay;

  },

  obtenerLiquidez() {

    return calcularCajaVirtual();

  },

  obtenerFlujoMensual() {

    const resumen = JSON.parse(generarDatosMaestros());

    return resumen.flujoAcumulativoMensual;

  },

  obtenerFlujoSemestral() {

    const resumen = JSON.parse(generarDatosMaestros());

    return resumen.flujoSemestral;

  }

};
