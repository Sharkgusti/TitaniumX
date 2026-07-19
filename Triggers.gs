// =================================================================================
// ===  TITANIUM v2 — TRIGGERS.GS                                               ===
// ===  Procesos automáticos: consolidación de flujos RF + snapshot diario     ===
// =================================================================================

// 1. GENERADOR DE FLUJOS FUTUROS RF
function consolidarFuturosFlujosRF() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const outputSheetName = HOJAS.PROY;
    const exclude = ["Dashboard", HOJAS.LOG, HOJAS.CARTERA, HOJAS.PRECIOS, HOJAS.EVO,
                      HOJAS.HIST, HOJAS.QUANT, outputSheetName, "PARAM_FISCAL",
                      "FISCAL_BS_PERSONALES", "AUDITORIA_RESUMEN", "AUDITORIA_DETALLE"];

    let out = ss.getSheetByName(outputSheetName);
    if (!out) out = ss.insertSheet(outputSheetName);
    out.clear();
    out.getRange("A1:E1").setValues([["Ticker", "Fecha_pago", "Renta", "Amortizacion", "Total_Cobro"]]).setFontWeight("bold");

    const rows = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sheets = ss.getSheets();

    for (const sheet of sheets) {
        if (exclude.includes(sheet.getName())) continue;

        let qty = 0;
try { qty = sheet.getRange("K3").getValue(); } catch (e) { }
if (typeof qty !== 'number' || qty <= 0) continue;
if (qty === 100) continue; // Tenencia teórica de Bombonera (bono que no poseés) — excluir de la proyección real

        let ticker = sheet.getName();
        try { let nM = sheet.getRange("L1").getValue(); if (nM && String(nM).trim() !== "") ticker = String(nM).trim().toUpperCase(); } catch (e) { }

        const data = sheet.getDataRange().getValues();
        if (data.length < 3) continue;

        let divisorFrecuencia = 2;
        let frecuenciaManual = 0;
        if (data[0].length > 12) {
            let val = data[0][12];
            if (typeof val === 'number' && val > 0) frecuenciaManual = val;
        }

        if (frecuenciaManual > 0) {
            divisorFrecuencia = frecuenciaManual;
        } else {
            const fechasPagos = data.slice(2).map(r => r[2]).filter(d => d instanceof Date && !isNaN(d));
            if (fechasPagos.length > 1) {
                fechasPagos.sort((a, b) => a - b);
                let sumaDias = 0, conteo = 0;
                for (let k = 1; k < fechasPagos.length; k++) {
                    let diff = (fechasPagos[k] - fechasPagos[k - 1]) / (1000 * 60 * 60 * 24);
                    if (diff > 20 && diff < 400) { sumaDias += diff; conteo++; }
                }
                if (conteo > 0) {
                    let prom = sumaDias / conteo;
                    if (prom >= 25 && prom <= 45) divisorFrecuencia = 12;
                    else if (prom >= 80 && prom <= 100) divisorFrecuencia = 4;
                    else if (prom >= 160 && prom <= 200) divisorFrecuencia = 2;
                    else if (prom >= 340) divisorFrecuencia = 1;
                }
            }
        }
for (let i = 2; i < data.length; i++) {
            const row = data[i];
            let d = row[2];

            // 🚑 EL FIX: Si la fecha es texto (porque le borraste la hora), la convierte a Fecha Real
            if (typeof d === 'string' && d.includes('/')) {
                let partes = d.split('/');
                if (partes.length === 3) d = new Date(partes[2], partes[1] - 1, partes[0]);
            }

            if (d instanceof Date && !isNaN(d) && d >= today) {
                // 🚑 EL FIX: Lee los números incluso si Sheets los transformó en texto
                let tA = parseFloat(String(row[3]).replace('%', '').replace(',', '.')) || 0;
                let tAm = parseFloat(String(row[5]).replace('%', '').replace(',', '.')) || 0;
                let valR = row[6];
                let tR = (valR !== "" && valR !== null) ? (parseFloat(String(valR).replace('%', '').replace(',', '.')) || 0) : 1;

                if (tA > 1) tA /= 100; if (tAm > 1) tAm /= 100; if (tR > 1) tR /= 100;

                let mAm = qty * tAm;
                let mR = (qty * tR * tA) / divisorFrecuencia;
                let tot = mR + mAm;

                if (tot > 0.01) rows.push([ticker, d, mR, mAm, tot]);
            }
        }
    }

    rows.sort((a, b) => a[1] - b[1]);
    if (rows.length) {
        out.getRange(2, 1, rows.length, 5).setValues(rows);
        out.getRange(2, 2, rows.length, 1).setNumberFormat("dd/MM/yyyy");
        out.getRange(2, 3, rows.length, 3).setNumberFormat("#,##0.00");
    }
}

// 2. CIERRE DIARIO — snapshot de evolución + histórico de precios
function REGISTRADOR_CIERRE_DIARIO() {
    const fechaHoy = new Date();
    if (fechaHoy.getDay() === 0 || fechaHoy.getDay() === 6) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const datosMaestros = JSON.parse(generarDatosMaestros());
    const valorTotalCartera = datosMaestros.kpis.valorTotal.usd;
    const valorSPY = obtenerPrecioSPY(ss);

    const hojaEvo = ss.getSheetByName(HOJAS.EVO);
    const totalCedears = (datosMaestros.carteraDetallada || [])
        .filter(p => p.tipo === 'Cedear')
        .reduce((s, p) => s + (p.valorUSD || 0), 0);

    if (hojaEvo) hojaEvo.appendRow([fechaHoy, valorTotalCartera, valorSPY, totalCedears]);

    SNAPSHOT_PRECIOS_HISTORICOS(ss, datosMaestros.carteraDetallada);
}

function SNAPSHOT_PRECIOS_HISTORICOS(ss, carteraDetallada) {
    try {
        const hojaHist = ss.getSheetByName(HOJAS.HIST);
        // CCL ahora vive en Precios!B4
        const ccl = ss.getSheetByName(HOJAS.PRECIOS).getRange("B4").getValue() || 1000;
        const fechaHoy = new Date();
        let filasAGuardar = [];

        carteraDetallada.forEach(p => {
            if (p.ticker && p.unidades > 0) {
                let valorActualPesos = p.valorUSD * ccl;
                let precioNormalizado = valorActualPesos / (p.unidades * ccl);
                filasAGuardar.push([fechaHoy, p.ticker, precioNormalizado]);
            }
        });

        if (filasAGuardar.length > 0) {
            hojaHist.getRange(hojaHist.getLastRow() + 1, 1, filasAGuardar.length, 3).setValues(filasAGuardar);
        }
    } catch (e) {
        console.error("Error Snapshot: " + e.message);
    }
}

function obtenerPrecioSPY(ss) {
    try {
        const datos = ss.getSheetByName(HOJAS.PRECIOS).getDataRange().getValues();
        for (let i = 1; i < datos.length; i++) {
            if (String(datos[i][0]).toUpperCase().trim() === 'INDICE_SPY') return datos[i][1];
        }
        return 0;
    } catch (e) { return 0; }
}
// -----------------------------------------------------------------------
// MENÚ UNIFICADO — única función onOpen() de todo el proyecto.
// Ningún otro archivo (.gs) debe declarar onOpen().
// -----------------------------------------------------------------------
function onOpen() {
    SpreadsheetApp.getUi().createMenu('⚙️ TITANIUM')
        .addItem('🔄 Actualizar Flujos RF', 'consolidarFuturosFlujosRF')
        .addSeparator()
        .addSubMenu(SpreadsheetApp.getUi().createMenu('🧾 Fiscal BP')
            .addItem('📊 Generar Informe BP', 'GENERAR_INFORME_BIENES_PERSONALES'))
        .addSubMenu(SpreadsheetApp.getUi().createMenu('📋 Auditoría')
            .addItem('🔍 Generar Auditoría Completa', 'GENERAR_AUDITORIA_COMPLETA'))
        .addSubMenu(SpreadsheetApp.getUi().createMenu('📊 Correlación Cedears')
            .addItem('🔄 Generar Análisis completo (1 año)', 'generarAnalisisCompleto')
            .addItem('🧹 Limpiar temporales', 'limpiarTemporales'))
        .addToUi();
}
// -----------------------------------------------------------------------
// INSTALADOR DE TRIGGER — consolidarFuturosFlujosRF()
// Corre una vez por semana: viernes 6 AM
// -----------------------------------------------------------------------
function instalarTriggerFlujosRF() {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'consolidarFuturosFlujosRF').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('consolidarFuturosFlujosRF')
        .timeBased()
        .onWeekDay(ScriptApp.WeekDay.FRIDAY)
        .atHour(6)
        .create();
    console.log("✅ Trigger Flujos RF instalado: viernes 6 AM.");
}
// -----------------------------------------------------------------------
// INSTALADOR DE TRIGGER — REGISTRADOR_CIERRE_DIARIO()
// Corre todos los días a las 19hs (la propia función ya filtra fines de
// semana internamente con fechaHoy.getDay()).
// -----------------------------------------------------------------------
function instalarTriggerCierreDiario() {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'REGISTRADOR_CIERRE_DIARIO').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('REGISTRADOR_CIERRE_DIARIO')
        .timeBased()
        .atHour(21)
        .everyDays(1)
        .create();
    console.log("✅ Trigger Cierre Diario instalado: todos los días 21hs.");
}