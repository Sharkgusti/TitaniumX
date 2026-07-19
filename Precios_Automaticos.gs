// =================================================================================
// ===  TITANIUM v2 — PRECIOS_AUTOMATICOS.GS                                    ===
// ===  Tres actualizadores: CCL, Compass/CAFCI, data912                        ===
// =================================================================================

// =================================================================================
// 1. CCL — dolarapi.com, escribe en Precios!Q:R + Precios!B4
// =================================================================================
function REGISTRAR_CCL_INTELIGENTE() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPrecios = ss.getSheetByName(HOJAS.PRECIOS);
    const tz = ss.getSpreadsheetTimeZone();
    const ahora = new Date();

    const diaSemana = parseInt(Utilities.formatDate(ahora, tz, "u"));
    const horaActual = parseInt(Utilities.formatDate(ahora, tz, "H"));
    if (diaSemana > 5 || horaActual < 11 || horaActual >= 19) {
        console.log("Fuera de horario o fin de semana.");
        return;
    }

    if (!hojaPrecios) { console.error("No se encontró 'Precios'"); return; }

    try {
        const response = UrlFetchApp.fetch("https://dolarapi.com/v1/dolares/contadoconliqui");
        const data = JSON.parse(response.getContentText());

        const hoyTextoISO = Utilities.formatDate(ahora, tz, "yyyy-MM-dd");
        const fechaApiISO = data.fechaActualizacion.split('T')[0];

        if (hoyTextoISO !== fechaApiISO) {
            console.warn("Dato de API viejo (posible feriado). No se escribe nada.");
            return;
        }

        const precio = parseFloat(data.venta);

        // Columnas Q=17, R=18. Buscamos la última fila CON DATO REAL en Q, no un número fijo.
        const COL_FECHA = 17, COL_PRECIO = 18;
        const ultimaFilaConDatos = hojaPrecios.getRange(1, COL_FECHA, hojaPrecios.getMaxRows(), 1)
            .getValues()
            .reduce((last, val, idx) => (val[0] !== "" && val[0] !== null) ? idx + 1 : last, 1);

        let filaDestino = ultimaFilaConDatos + 1;

        // Dedupe: si hoy ya se escribió, sobreescribimos esa fila en vez de duplicar
        if (ultimaFilaConDatos >= 2) {
            const fechaHoyVisual = Utilities.formatDate(ahora, tz, "d/M/yyyy");
            const valoresQ = hojaPrecios.getRange(2, COL_FECHA, ultimaFilaConDatos - 1, 1).getDisplayValues();
            for (let i = 0; i < valoresQ.length; i++) {
                if (valoresQ[i][0] === fechaHoyVisual || valoresQ[i][0] === hoyTextoISO.split('-').reverse().join('/')) {
                    filaDestino = i + 2;
                    break;
                }
            }
        }

        const celdaFecha = hojaPrecios.getRange(filaDestino, COL_FECHA);
        const celdaPrecio = hojaPrecios.getRange(filaDestino, COL_PRECIO);

        celdaFecha.setValue(hoyTextoISO);
        celdaPrecio.setValue(precio);
        celdaFecha.setNumberFormat("dd/mm/yyyy");

        if (filaDestino > 2) {
            const formatoPrecioArriba = hojaPrecios.getRange(filaDestino - 1, COL_PRECIO).getNumberFormat();
            celdaPrecio.setNumberFormat(formatoPrecioArriba);
        }

        // Escritura directa del precio vigente — ya no depende de INDICE/CONTARA
        hojaPrecios.getRange("B4").setValue(precio);

        SpreadsheetApp.flush();
        console.log(`Éxito. Fila ${filaDestino} (Q:R) y B4 actualizados con $${precio}.`);

    } catch (e) {
        console.error("Error CCL: " + e.message);
    }
}

// =================================================================================
// 2. COMPASS / CAFCI — fondos en bloque protegido (filas 1-19)
// =================================================================================
function ACTUALIZAR_PRECIOS_CAFCI() {
    const HOJA_PRECIOS = 'Precios';

    const hoy = new Date();
    const diaSemana = hoy.getDay();
    if (diaSemana === 0 || diaSemana === 6) {
        Logger.log('Fin de semana detectado. No se actualizan fondos.');
        return;
    }

    const FONDOS = [
    { ticker: 'CAU$D',    codigoCAFCI: 2112, usarNativoUSD: false },
    { ticker: 'CBIDEA',   codigoCAFCI: 2106, usarNativoUSD: false },
    { ticker: 'CCREC2',   codigoCAFCI: 788,  usarNativoUSD: false },
    { ticker: 'COPPORT',  codigoCAFCI: 338,  usarNativoUSD: false },
    { ticker: 'COCORMA',  codigoCAFCI: 2517, usarNativoUSD: false },
    { ticker: 'COCOSPPA', codigoCAFCI: 5496, usarNativoUSD: false },
    { ticker: 'ALLFD',    codigoCAFCI: 5901, usarNativoUSD: true  },
    { ticker: 'BAHUSD',   codigoCAFCI: 2096, usarNativoUSD: true  },
];

    Logger.log('Descargando planilla diaria CAFCI...');
    let blob;
    try {
        const resp = UrlFetchApp.fetch('https://download.cafci.org.ar/Planilla_Diaria_A.xlsx', {
            muteHttpExceptions: true,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.cafci.org.ar/' }
        });
        if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
        blob = resp.getBlob();
    } catch (e) {
        Logger.log('Error de descarga: ' + e.message + '. Se conservan los precios anteriores.');
        return;
    }

    let tempSheet;
    try {
        blob.setName('planilla_cafci.xlsx');
        const tempFile = Drive.Files.create(
            { name: 'TEMP_CAFCI_' + new Date().getTime(), mimeType: MimeType.GOOGLE_SHEETS },
            blob
        );
        tempSheet = SpreadsheetApp.openById(tempFile.id);
    } catch (e) {
        Logger.log('Error de conversión API Drive: ' + e.message);
        return;
    }

    let preciosNuevos = {};
    try {
        const datosExcel = tempSheet.getSheets()[0].getDataRange().getValues();

        // Índice por Código CAFCI (columna U = índice 20) — matching exacto, sin ambigüedad de texto
        const indicePorCodigo = {};
        for (let r = 10; r < datosExcel.length; r++) {
            const codigo = datosExcel[r][20];
            if (typeof codigo === 'number') indicePorCodigo[codigo] = r;
        }

        for (const fondo of FONDOS) {
    const fila = indicePorCodigo[fondo.codigoCAFCI];
    if (fila === undefined) { Logger.log(`⚠️ No se encontró el código CAFCI ${fondo.codigoCAFCI} (${fondo.ticker}) hoy.`); continue; }
    const row = datosExcel[fila];
    const valorNativoRaw = row[5];
    const valorReexpresadoRaw = row[8];

    let valorFinalRaw = valorNativoRaw;
    if (!fondo.usarNativoUSD && typeof valorReexpresadoRaw === 'number' && valorReexpresadoRaw > 0) {
        valorFinalRaw = valorReexpresadoRaw;
    }
    if (typeof valorFinalRaw === 'number') {
        preciosNuevos[fondo.ticker] = valorFinalRaw / 1000;
    }
}
    } catch (e) {
        Logger.log('Error al procesar Excel: ' + e.message);
    } finally {
        try { DriveApp.getFileById(tempSheet.getId()).setTrashed(true); } catch (e) { }
    }

    if (Object.keys(preciosNuevos).length === 0) {
        Logger.log('No se pudieron extraer precios. Se conservan los anteriores.');
        return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPrecios = ss.getSheetByName(HOJA_PRECIOS);
    if (!hojaPrecios) { Logger.log('No se encontró la pestaña ' + HOJA_PRECIOS); return; }

    const datosPrecios = hojaPrecios.getDataRange().getValues();
    for (let i = 1; i < datosPrecios.length; i++) {
        let tickerActual = String(datosPrecios[i][0]).toUpperCase().trim();
        if (preciosNuevos[tickerActual]) {
            hojaPrecios.getRange(i + 1, 2).setValue(preciosNuevos[tickerActual]);
            Logger.log(`✅ Actualizado: ${tickerActual} -> ${preciosNuevos[tickerActual]}`);
        }
    }

    Logger.log('¡Actualización de Fondos CAFCI finalizada con éxito!');
}

// -----------------------------------------------------------------------
// INSTALADOR — reemplaza instalarTriggerCompass(). Borra el trigger viejo
// (nombre anterior) además del nuevo, para no dejar un trigger huérfano
// apuntando a una función que ya no existe.
// -----------------------------------------------------------------------
function instalarTriggerCAFCI() {
    ScriptApp.getProjectTriggers().filter(t =>
        t.getHandlerFunction() === 'ACTUALIZAR_PRECIOS_COMPASS' ||
        t.getHandlerFunction() === 'ACTUALIZAR_PRECIOS_CAFCI'
    ).forEach(t => ScriptApp.deleteTrigger(t));

    ScriptApp.newTrigger('ACTUALIZAR_PRECIOS_CAFCI')
        .timeBased()
        .onWeekDay(ScriptApp.WeekDay.MONDAY).onWeekDay(ScriptApp.WeekDay.TUESDAY)
        .onWeekDay(ScriptApp.WeekDay.WEDNESDAY).onWeekDay(ScriptApp.WeekDay.THURSDAY)
        .onWeekDay(ScriptApp.WeekDay.FRIDAY)
        .atHour(20).create();
    console.log("✅ Trigger CAFCI instalado: L-V 20-21hs.");
}

// =================================================================================
// 3. DATA912 — Cedears/Acciones/Bonos/ONs, desde fila 20
//    FIX: solo se limpia/reescribe una categoría si su fetch fue exitoso
// =================================================================================
function actualizarPrecios() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaPrecios = ss.getSheetByName(HOJAS.PRECIOS);
    const hojaCartera = ss.getSheetByName(HOJAS.CARTERA);

    if (!hojaPrecios || !hojaCartera) {
        console.error("No se encontró 'Precios' o 'Cartera'");
        return;
    }

    const lastRowCartera = hojaCartera.getLastRow();
    if (lastRowCartera < 2) { console.warn("Cartera vacía"); return; }

    const dataCartera = hojaCartera.getRange(2, 1, lastRowCartera - 1, 2).getValues();

    const grupos = {
        "Cedear":       new Set(),
        "Acciones":     new Set(),
        "Bonos":        new Set(),
        "O Negociable": new Set()
    };
    dataCartera.forEach(([ticker, tipo]) => {
        const t = String(ticker).trim().toUpperCase();
        const tp = String(tipo).trim();
        if (grupos[tp] && t) grupos[tp].add(t);
    });

    const endpoints = {
        "Cedear":       "https://data912.com/live/arg_cedears",
        "Acciones":     "https://data912.com/live/arg_stocks",
        "Bonos":        "https://data912.com/live/arg_bonds",
        "O Negociable": "https://data912.com/live/arg_corp"
    };

    // fetchOk[tipo] = true solo si ese endpoint respondió bien
    const precios = {};
    const fetchOk = {};

    Object.entries(endpoints).forEach(([tipo, url]) => {
        fetchOk[tipo] = false;
        try {
            const resp = UrlFetchApp.fetch(url, {
                muteHttpExceptions: true,
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            if (resp.getResponseCode() !== 200) {
                console.error(`HTTP ${resp.getResponseCode()} → ${url}. Se conserva el bloque anterior de ${tipo}.`);
                return;
            }
            JSON.parse(resp.getContentText()).forEach(item => {
                const sym = String(item.symbol || "").trim().toUpperCase();
                precios[sym] = item.c || 0;
            });
            fetchOk[tipo] = true;
        } catch (e) {
            console.error(`Error en ${url}: ${e.message}. Se conserva el bloque anterior de ${tipo}.`);
        }
    });

    // Si NINGÚN fetch tuvo éxito, no tocamos nada de la hoja
    if (!Object.values(fetchOk).some(v => v)) {
        console.warn("Ningún endpoint respondió. No se modifica Precios.");
        return;
    }

    // --- Leer el estado actual del bloque (fila 20+) para preservar las categorías que fallaron ---
    const FILA_INICIO = 20;
    const ultimaFilaActual = hojaPrecios.getLastRow();
    let bloqueViejo = { data: [], background: [] };
    if (ultimaFilaActual >= FILA_INICIO) {
        const rango = hojaPrecios.getRange(FILA_INICIO, 1, ultimaFilaActual - FILA_INICIO + 1, 2);
        bloqueViejo.data = rango.getValues();
        bloqueViejo.background = rango.getBackgrounds();
    }

    // Identificar, dentro del bloque viejo, qué filas pertenecían a categorías que SÍ tuvieron éxito
    // (esas se van a reescribir); las de categorías que fallaron, se preservan tal cual.
    const ordenCategorias = ["Cedear", "Acciones", "Bonos", "O Negociable"];
    let filasAPreservar = []; // filas viejas de categorías fallidas, para volver a pegarlas

    if (bloqueViejo.data.length > 0) {
        let categoriaActual = null;
        for (let i = 0; i < bloqueViejo.data.length; i++) {
            const val = String(bloqueViejo.data[i][0] || "").trim();
            if (ordenCategorias.map(c => c.toUpperCase()).includes(val.toUpperCase())) {
                categoriaActual = ordenCategorias.find(c => c.toUpperCase() === val.toUpperCase());
            }
            if (categoriaActual && !fetchOk[categoriaActual]) {
                filasAPreservar.push({ fila: bloqueViejo.data[i], fondo: bloqueViejo.background[i] });
            }
        }
    }

    // Limpiar todo el bloque (lo reconstruimos entero: éxitos con datos nuevos + fallos con datos preservados)
    if (ultimaFilaActual >= FILA_INICIO) {
        hojaPrecios.getRange(FILA_INICIO, 1, ultimaFilaActual - FILA_INICIO + 1, 2).clearContent().clearFormat();
    }

    const AZUL_HEADER = "#1a73e8";
    const BLANCO = "#ffffff";
    const AMARILLO_CLARO = "#fff9e6";
    const AMARILLO_ALT = "#fffdf5";
    const GRIS_SUBHEADER = "#f0f0f0";

    let filaActual = FILA_INICIO;

    ordenCategorias.forEach((tipo, idx) => {
        if (fetchOk[tipo]) {
            // --- Categoría con datos frescos: reescribimos completa ---
            const tickers = [...grupos[tipo]].sort();
            if (tickers.length === 0) return;

            const rHeader = hojaPrecios.getRange(filaActual, 1, 1, 2);
            rHeader.merge().setValue(tipo.toUpperCase())
                .setBackground(AZUL_HEADER).setFontColor(BLANCO).setFontWeight("bold")
                .setFontSize(10).setFontFamily("Arial").setHorizontalAlignment("center");
            filaActual++;

            hojaPrecios.getRange(filaActual, 1).setValue("Ticker");
            hojaPrecios.getRange(filaActual, 2).setValue("Último Operado");
            hojaPrecios.getRange(filaActual, 1, 1, 2)
                .setBackground(GRIS_SUBHEADER).setFontWeight("bold").setFontFamily("Arial")
                .setFontSize(10).setHorizontalAlignment("center");
            filaActual++;

            tickers.forEach((ticker, i) => {
                const precio = precios[ticker] !== undefined ? precios[ticker] : "";
                const fondo = i % 2 === 0 ? AMARILLO_CLARO : AMARILLO_ALT;

                hojaPrecios.getRange(filaActual, 1).setValue(ticker)
                    .setBackground(fondo).setFontFamily("Arial").setFontSize(10)
                    .setFontWeight("normal").setHorizontalAlignment("left");
                hojaPrecios.getRange(filaActual, 2).setValue(precio)
                    .setBackground(fondo).setFontFamily("Arial").setFontSize(10)
                    .setNumberFormat("#,##0.00").setHorizontalAlignment("right");
                filaActual++;
            });

        } else {
            // --- Categoría que falló: repegamos las filas viejas tal cual estaban ---
            const propias = filasAPreservar; // ya filtradas por categoría en el loop de arriba
            // (nota: si hay varias categorías fallidas, filasAPreservar mezcla todas;
            //  para simplicidad y robustez, si falló, mejor repegar TODO el bloque viejo completo)
        }

        if (idx < ordenCategorias.length - 1 && fetchOk[tipo]) filaActual++;
    });

    // Repegar TODO el conjunto de filas preservadas (categorías fallidas) al final del bloque nuevo
    if (filasAPreservar.length > 0) {
        filaActual++; // separador
        filasAPreservar.forEach(item => {
            hojaPrecios.getRange(filaActual, 1).setValue(item.fila[0]).setBackground(item.fondo[0]);
            hojaPrecios.getRange(filaActual, 2).setValue(item.fila[1]).setBackground(item.fondo[1]);
            filaActual++;
        });
    }

    hojaPrecios.setColumnWidth(1, 120);
    hojaPrecios.setColumnWidth(2, 140);

    console.log(`✅ Escritura finalizada | Categorías OK: ${Object.keys(fetchOk).filter(k => fetchOk[k]).join(', ')} | ${Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm:ss")}`);
}

// =================================================================================
// 4. INSTALADORES DE TRIGGERS (ejecutar cada uno UNA sola vez)
// =================================================================================
function instalarTriggerCCL() {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'REGISTRAR_CCL_INTELIGENTE').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('REGISTRAR_CCL_INTELIGENTE').timeBased().everyMinutes(30).create();
    console.log("✅ Trigger CCL instalado: cada 30 minutos (con filtro horario interno).");
}

function instalarTriggerCompass() {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'ACTUALIZAR_PRECIOS_COMPASS').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('ACTUALIZAR_PRECIOS_COMPASS')
        .timeBased()
        .onWeekDay(ScriptApp.WeekDay.MONDAY).onWeekDay(ScriptApp.WeekDay.TUESDAY)
        .onWeekDay(ScriptApp.WeekDay.WEDNESDAY).onWeekDay(ScriptApp.WeekDay.THURSDAY)
        .onWeekDay(ScriptApp.WeekDay.FRIDAY)
        .atHour(18).create();
    console.log("✅ Trigger Compass instalado: L-V 18-19hs.");
}

function instalarTriggerData912() {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'actualizarPrecios').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('actualizarPrecios').timeBased().everyMinutes(15).create();
    console.log("✅ Trigger data912 instalado: cada 15 minutos.");
}