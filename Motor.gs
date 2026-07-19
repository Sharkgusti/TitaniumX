// =================================================================================
// ===  TITANIUM v2 — MOTOR.GS                                                  ===
// ===  Única fuente: Log_Transacciones_TITANIUM                                ===
// =================================================================================

const HOJAS = {
    LOG: "Log_Transacciones_TITANIUM",
    PRECIOS: "Precios",
    CARTERA: "Cartera",
    EVO: "Evolucion cartera",
    PROY: "Proyeccion_Flujos_RF",
    HIST: "Historico_Precios",
    QUANT: "Analisis_Quant"
};

const HOY_SIMULADA = new Date();
const FECHA_CORTE_CAJA = new Date('2026-02-01');
const SALDO_INICIAL_CAJA = 14;

// 1. API WEB APP
function doGet(e) {
  // Si entran con ?page=bombonera, ejecuta la función agregando () al final
  if (e && e.parameter && e.parameter.page === 'bombonera') {
    return doGetBombonera(); 
  }
  
  // Por defecto levanta el Titanium v2 original
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('TITANIUM v2')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 2. MOTOR PRINCIPAL
function generarDatosMaestros() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const logData = ss.getSheetByName(HOJAS.LOG).getDataRange().getValues();
    const preciosData = ss.getSheetByName(HOJAS.PRECIOS).getDataRange().getValues();

    // CCL: ahora vive en Precios!B4 (fila "USD"), escrito directo por el script del CCL
    let ccl = 1000;
    try {
        const val = ss.getSheetByName(HOJAS.PRECIOS).getRange("B4").getValue();
        if (typeof val === 'number' && val > 500) ccl = val;
    } catch (e) { }

    // Precios: tk -> { precio, var, moneda }  ("USD" | "PESOS" | "" )
    const precios = {};
    for (let i = 1; i < preciosData.length; i++) {
        let tk = String(preciosData[i][0]).toUpperCase().trim();
        let pr = cleanNum(preciosData[i][1]);
        let moneda = String(preciosData[i][2] || "").toUpperCase().trim();
        let vr = cleanNum(preciosData[i][4]); // variación diaria, si existiera en col E
        if (tk && pr > 0) precios[tk] = { precio: pr, var: vr, moneda: moneda };
    }

    let portfolio = {};
    let realizedPL_RV = 0;
    let cfRV = [], cfRF = [], cfTOTAL = [];
    let cashflowsPorTicker = {};
    let cajaVirtual = calcularCajaVirtual();

    let statsDivs = { tickers: {}, years: {}, total: 0 };
    let statsRenta = { tickers: {}, years: {}, total: 0 };
    let rentaHistorica12m = {};
    let fechaHaceUnAnio = new Date(); fechaHaceUnAnio.setFullYear(fechaHaceUnAnio.getFullYear() - 1);

    // --- Tracking del costo total vivo SOLO de Renta Fija, para el Yield Realizado por año ---
    // Cada vez que compra/venta/amortización de un instrumento RF cambian el costo, guardamos
    // (fecha, costo total RF nuevo). La renta/interés NO mueve esto.
    let totalCostoVivoRF = 0;
    let costoEventsRF = [];

    const logSinHeader = logData.slice(1);
    logSinHeader.sort((a, b) => new Date(a[1]) - new Date(b[1]));

    // --- Detección automática: tickers que NUNCA tuvieron un cupón/renta explícito ---
    // (FCI, "Cartera admin", plazos fijos, bonos duales/LECAPs sin cupón corrido).
    // Se evalúa sobre TODA la historia del log, así que no importa el orden de
    // procesamiento: si en algún momento (pasado o futuro) el ticker paga un
    // cupón real, queda excluido para siempre de la renta implícita.
    let tickersConRentaExplicita = new Set();
    logSinHeader.forEach(row => {
        const tk = String(row[3]).toUpperCase().trim();
        const mv = String(row[5]).toLowerCase().trim();
        if (tk && (mv.includes('dividendo') || mv.includes('renta') || mv.includes('interes'))) {
            tickersConRentaExplicita.add(tk);
        }
    });
    let unitEventsPorTicker = {}; // { ticker: [{d, q}] } — cantidad tenida a lo largo del tiempo

    for (let i = 0; i < logSinHeader.length; i++) {
        const row = logSinHeader[i];
        const fecha = new Date(row[1]);
        const year = fecha.getFullYear();
        const ticker = String(row[3]).toUpperCase().trim();
        const tipoStr = String(row[4]);
        const mov = String(row[5]).toLowerCase().trim();
        const cant = cleanNum(row[6]);
        const montoUSD = Math.abs(cleanNum(row[10]));
        const ratioSplit = cleanNum(row[11]);

        if (!ticker) continue;

        // ===============================================================
        // FIX #1: USD/CASH nunca es una posición — se salta después de la caja
        // ===============================================================
        if (ticker === 'USD' || ticker === 'CASH') continue;

        if (!portfolio[ticker]) portfolio[ticker] = { q: 0, costo: 0, costoOriginal: 0, tipo: tipoStr, cobrado: 0, wDate: null };
        if (!cashflowsPorTicker[ticker]) cashflowsPorTicker[ticker] = [];
        if (!unitEventsPorTicker[ticker]) unitEventsPorTicker[ticker] = [];
        let p = portfolio[ticker];

        const esRV = tipoStr.toLowerCase().includes('cedear') || tipoStr.toLowerCase().includes('accion');
        const esRF = !esRV;

        if (mov.includes('compra') || mov.includes('aporte') || mov.includes('suscripcion') || mov.includes('canje_entrada')) {
            let fechaMs = fecha.getTime();
            if (p.q <= 0 || !p.wDate) p.wDate = fechaMs;
            else p.wDate = ((p.q * p.wDate) + (cant * fechaMs)) / (p.q + cant);

            p.q += cant;
            p.costo += montoUSD;
            p.costoOriginal += montoUSD;
            unitEventsPorTicker[ticker].push({ d: fecha, q: p.q });
            if (esRV) cfRV.push({ d: fecha, v: -montoUSD });
            if (esRF) cfRF.push({ d: fecha, v: -montoUSD });
            cfTOTAL.push({ d: fecha, v: -montoUSD });
            cashflowsPorTicker[ticker].push({ d: fecha, v: -montoUSD });

            if (esRF) {
                totalCostoVivoRF += montoUSD;
                costoEventsRF.push({ d: fecha, c: totalCostoVivoRF });
            }

        } else if (mov.includes('venta') || mov.includes('rescate') || mov.includes('canje_salida')) {
            if (p.q > 0) {
                let ppc = p.costo / p.q;
                // FIX: costoOriginal se descuenta con su propio ppc original, no el residual
                let ppcOriginal = p.costoOriginal / p.q;
                let costoVenta = ppc * cant;
                let costoOriginalVenta = ppcOriginal * cant;
                let ganancia = montoUSD - costoVenta;

                if (esRV) realizedPL_RV += ganancia;
                p.q -= cant;
                p.costo -= costoVenta;
                p.costoOriginal -= costoOriginalVenta;
                if (p.q < 0.0001) { p.q = 0; p.costo = 0; p.costoOriginal = 0; }
                unitEventsPorTicker[ticker].push({ d: fecha, q: p.q });

                if (esRV) cfRV.push({ d: fecha, v: montoUSD });
                if (esRF) cfRF.push({ d: fecha, v: montoUSD });
                cfTOTAL.push({ d: fecha, v: montoUSD });
                cashflowsPorTicker[ticker].push({ d: fecha, v: montoUSD });

                if (esRF) {
                    totalCostoVivoRF -= costoVenta;
                    costoEventsRF.push({ d: fecha, c: totalCostoVivoRF });
                }
            }

        } else if (mov.includes('dividendo') || mov.includes('renta') || mov.includes('interes')) {
            if (esRV) { realizedPL_RV += montoUSD; cfRV.push({ d: fecha, v: montoUSD }); }
            if (esRF) cfRF.push({ d: fecha, v: montoUSD });
            cfTOTAL.push({ d: fecha, v: montoUSD });
            cashflowsPorTicker[ticker].push({ d: fecha, v: montoUSD });
            p.cobrado += montoUSD;

            if (fecha >= fechaHaceUnAnio) rentaHistorica12m[ticker] = (rentaHistorica12m[ticker] || 0) + montoUSD;

            if (mov.includes('dividendo')) {
                statsDivs.tickers[ticker] = (statsDivs.tickers[ticker] || 0) + montoUSD;
                statsDivs.years[year] = (statsDivs.years[year] || 0) + montoUSD;
                statsDivs.total += montoUSD;
            } else {
                statsRenta.tickers[ticker] = (statsRenta.tickers[ticker] || 0) + montoUSD;
                statsRenta.years[year] = (statsRenta.years[year] || 0) + montoUSD;
                statsRenta.total += montoUSD;
            }

        } else if (mov.includes('amortiza')) {
            p.cobrado += montoUSD;
            let reduccionCostoRF = Math.min(montoUSD, p.costo);
            if (montoUSD > p.costo) {
                let gananciaExtra = montoUSD - p.costo;
                p.costo = 0;
                statsRenta.tickers[ticker] = (statsRenta.tickers[ticker] || 0) + gananciaExtra;
                statsRenta.years[year] = (statsRenta.years[year] || 0) + gananciaExtra;
                statsRenta.total += gananciaExtra;
            } else {
                p.costo -= montoUSD;
            }
            if (esRF) cfRF.push({ d: fecha, v: montoUSD });
            cfTOTAL.push({ d: fecha, v: montoUSD });
            cashflowsPorTicker[ticker].push({ d: fecha, v: montoUSD });

            if (esRF) {
                totalCostoVivoRF -= reduccionCostoRF;
                costoEventsRF.push({ d: fecha, c: totalCostoVivoRF });
            }

        } else if (mov.includes('split')) {
            // ===============================================================
            // FIX #4: Split y Contra-Split unificados.
            // Ratio_Split es SIEMPRE el multiplicador directo sobre cantidad.
            // Split 2x1 -> ratio=2 | Contra-Split 10x1 -> ratio=0.1
            // El costo NUNCA se toca.
            // ===============================================================
            if (ratioSplit > 0 && p.q > 0) {
                p.q = p.q * ratioSplit;
                unitEventsPorTicker[ticker].push({ d: fecha, q: p.q });
            }
        }
    }

    costoEventsRF.sort((a, b) => a.d - b.d);

    // Lectura COMPLETA (sin submuestreo) — la necesitamos para calcular la
    // renta implícita con precisión. hPrecios (más abajo) sigue siendo la
    // versión recortada a 150 puntos, usada solo por el gráfico del modal.
    const hPreciosCompleto = leerHistPreciosCompleto(ss.getSheetByName(HOJAS.HIST));

    // =====================================================================
    // RENTA IMPLÍCITA — para tickers de Renta Fija que NUNCA pagaron un
    // cupón explícito (FCI, Cartera admin, Plazos Fijos, duales/LECAPs sin
    // cupón corrido). Usa Modified Dietz año por año: aísla la ganancia por
    // variación de precio, sin que compras/rescates del período la distorsionen.
    // Si el ticker se vendió del todo dentro del año, "valorFin" da 0 y la
    // fórmula colapsa sola a "ganancia de venta" — mismo mecanismo sirve para
    // los que mantenés hasta el vencimiento y para los que cotizan a diario.
    // =====================================================================
    Object.keys(unitEventsPorTicker).forEach(tk => {
        if (tickersConRentaExplicita.has(tk)) return; // tiene cupón real, no tocar
        const p = portfolio[tk];
        if (!p) return;
        const tipoNorm = normalizar(p.tipo);
        const esRFTk = tipoNorm !== 'Cedear' && tipoNorm !== 'Acciones';
        if (!esRFTk) return; // esto es solo para Renta Fija / FCI / Cartera admin / Liquidez

        const eventosQ = unitEventsPorTicker[tk].slice().sort((a, b) => a.d - b.d);
        if (eventosQ.length === 0) return;

        const preciosHist = (hPreciosCompleto[tk] || []).map(pt => ({ d: new Date(pt[0]), p: pt[1] })).sort((a, b) => a.d - b.d);

        const buscarPrecio = (fecha) => {
            let ultimo = null;
            for (let i = 0; i < preciosHist.length; i++) {
                if (preciosHist[i].d <= fecha) ultimo = preciosHist[i].p;
                else break;
            }
            return ultimo; // null si no hay ningún dato REAL disponible a esa fecha — no se inventa nada
        };
        const buscarUnidades = (fecha) => {
            let ultimo = 0;
            for (let i = 0; i < eventosQ.length; i++) {
                if (eventosQ[i].d <= fecha) ultimo = eventosQ[i].q;
                else break;
            }
            return ultimo;
        };

        const primerAnio = eventosQ[0].d.getFullYear();
        const ultimoAnio = HOY_SIMULADA.getFullYear();

        for (let anio = primerAnio; anio <= ultimoAnio; anio++) {
            const inicioAnio = new Date(anio, 0, 1);
            const finAnio = new Date(anio, 11, 31);
            const corte = (anio === ultimoAnio) ? HOY_SIMULADA : finAnio;

            const unidadesInicio = buscarUnidades(new Date(inicioAnio.getTime() - 86400000));
            const unidadesFin = buscarUnidades(corte);
            const precioInicio = (unidadesInicio > 0) ? buscarPrecio(inicioAnio) : 0;
            const precioFin = (unidadesFin > 0) ? buscarPrecio(corte) : 0;

            // Si necesitábamos un precio real (porque había posición) y no lo tenemos
            // (el histórico no llega tan atrás), NO calculamos este año — mejor
            // "sin dato" que un número inventado con un precio de otra época.
            if ((unidadesInicio > 0 && precioInicio === null) || (unidadesFin > 0 && precioFin === null)) continue;

            const valorInicio = unidadesInicio * (precioInicio || 0);
            const valorFin = unidadesFin * (precioFin || 0);

            let comprasAnio = 0, rescatesAnio = 0;
            for (let i = 0; i < logSinHeader.length; i++) {
                const rowX = logSinHeader[i];
                const tkX = String(rowX[3]).toUpperCase().trim();
                if (tkX !== tk) continue;
                const fX = new Date(rowX[1]);
                if (fX.getFullYear() !== anio) continue;
                const mvX = String(rowX[5]).toLowerCase().trim();
                const montoX = Math.abs(cleanNum(rowX[10]));
                if (mvX.includes('compra') || mvX.includes('aporte') || mvX.includes('suscripcion') || mvX.includes('canje_entrada')) comprasAnio += montoX;
                else if (mvX.includes('venta') || mvX.includes('rescate') || mvX.includes('amortiza') || mvX.includes('canje_salida')) rescatesAnio += montoX;
            }

            if (unidadesInicio === 0 && unidadesFin === 0 && comprasAnio === 0 && rescatesAnio === 0) continue;

            const ganancia = valorFin - valorInicio - comprasAnio + rescatesAnio;
            if (Math.abs(ganancia) < 0.01) continue;

            statsRenta.tickers[tk] = (statsRenta.tickers[tk] || 0) + ganancia;
            statsRenta.years[anio] = (statsRenta.years[anio] || 0) + ganancia;
            statsRenta.total += ganancia;
        }
    });

    const formatObj = (obj, total) => ({
        total: total,
        porTicker: Object.keys(obj.tickers).map(k => ({ ticker: k, monto: obj.tickers[k] })).sort((a, b) => b.monto - a.monto),
        porAno: Object.keys(obj.years).map(k => ({ ano: parseInt(k), monto: obj.years[k] })).sort((a, b) => b.ano - a.ano)
    });
    const resDivs = formatObj(statsDivs, statsDivs.total);

    // resRenta: igual que formatObj, pero con costoPromedio y yield agregados por año
    const resRenta = {
        total: statsRenta.total,
        porTicker: Object.keys(statsRenta.tickers).map(k => ({ ticker: k, monto: statsRenta.tickers[k] })).sort((a, b) => b.monto - a.monto),
        porAno: Object.keys(statsRenta.years).map(k => {
            let anio = parseInt(k);
            let monto = statsRenta.years[anio];
            let cp = calcCostoPromedioPonderado(costoEventsRF, anio, HOY_SIMULADA);
            let yieldCrudo = cp.costoProm > 0 ? monto / cp.costoProm : 0;
            let yieldFinal = (cp.esParcial && cp.dias > 0) ? yieldCrudo * 365 / cp.dias : yieldCrudo;
            return { ano: anio, monto: monto, costoPromedio: cp.costoProm, yield: yieldFinal, parcial: cp.esParcial };
        }).sort((a, b) => b.ano - a.ano)
    };

    // Renta futura RF (tickers ya en pesos, sin necesidad de variantes D/O)
    let rentaFutura12m = {};
    let fechaDentroUnAnio = new Date(); fechaDentroUnAnio.setFullYear(fechaDentroUnAnio.getFullYear() + 1);
    try {
        const proyData = ss.getSheetByName(HOJAS.PROY).getDataRange().getValues();
        for (let r = 1; r < proyData.length; r++) {
            let tk = String(proyData[r][0]).trim().toUpperCase();
            let fecha = new Date(proyData[r][1]);
            let montoRenta = cleanNum(proyData[r][2]);
            if (fecha <= fechaDentroUnAnio && montoRenta > 0) {
                rentaFutura12m[tk] = (rentaFutura12m[tk] || 0) + montoRenta;
            }
        }
    } catch (e) { }

    let lista = [], valTotalUSD = 0, costoTotal = 0, dist = {};
    let valFinalRV = 0, valFinalRF = 0;
    let valorTotalRV = 0, costoTotalRV = 0;
    let rentaAnualTotalEstimada = 0;

    Object.keys(portfolio).forEach(tk => {
        let p = portfolio[tk];
        if (p.q <= 0.01) return;

        let pxData = precios[tk] || { precio: 0, var: 0, moneda: "" };
        let precioARS = pxData.precio;
        let monedaFlag = pxData.moneda; // "USD" | "PESOS" | ""
        let valUSD = 0;
        let tipoNorm = normalizar(p.tipo);

        // =====================================================================
        // REGLA DE VALUACIÓN — reemplaza la heurística ">20 -> /100"
        // =====================================================================
        if (tipoNorm === 'Bonos' || tipoNorm === 'ONs') {
            if (monedaFlag === 'USD') valUSD = precioARS * p.q;
            else if (monedaFlag === 'PESOS') valUSD = (precioARS / ccl) * p.q;
            else valUSD = (precioARS / ccl / 100) * p.q; // default: cotiza por c/100 VN
        } else if (tipoNorm === 'Cedear' || tipoNorm === 'Acciones') {
            valUSD = (precioARS / ccl) * p.q; // Acciones locales y Cedears: siempre pesos
        } else {
            // FCI / Cartera admin / manuales
            if (monedaFlag === 'USD') valUSD = precioARS * p.q;
            else valUSD = (precioARS / ccl) * p.q; // default PESOS
        }

        cashflowsPorTicker[tk].push({ d: HOY_SIMULADA, v: valUSD });
        valTotalUSD += valUSD;
        costoTotal += p.costo;

        let esRV = tipoNorm === 'Cedear' || tipoNorm === 'Acciones';
        if (esRV) { valorTotalRV += valUSD; costoTotalRV += p.costo; valFinalRV += valUSD; }
        else { valFinalRF += valUSD; }

        dist[tipoNorm] = (dist[tipoNorm] || 0) + valUSD;

        let rentaEstimada = (tipoNorm === 'Bonos' || tipoNorm === 'ONs') ? (rentaFutura12m[tk] || 0) : (rentaHistorica12m[tk] || 0);
        rentaAnualTotalEstimada += rentaEstimada;

        let roi = (p.costoOriginal > 0) ? (valUSD + p.cobrado) / p.costoOriginal - 1 : 0;
        let xirrCalculado = calcXIRR(cashflowsPorTicker[tk]);
        let diasTenencia = p.wDate ? Math.floor((HOY_SIMULADA.getTime() - p.wDate) / 86400000) : 0;

        lista.push({
            ticker: tk, tipo: tipoNorm,
            unidades: p.q, costoUSD: p.costo, valorUSD: valUSD,
            variacionDiaria: pxData.var,
            plPorcentaje: roi,
            xirr: xirrCalculado,
            yoc: (p.costo > 0) ? rentaEstimada / p.costo : 0,
            currentYield: (valUSD > 0) ? rentaEstimada / valUSD : 0,
            totalCobrado: p.cobrado,
            diasTenencia: diasTenencia
        });
    });

    if (cajaVirtual !== 0) {
        lista.push({
            ticker: 'LIQUIDEZ_AUTO', tipo: 'Liquidez',
            unidades: cajaVirtual, costoUSD: cajaVirtual, valorUSD: cajaVirtual,
            variacionDiaria: 0, plPorcentaje: 0, xirr: 0, yoc: 0, currentYield: 0, totalCobrado: 0, diasTenencia: ''
        });
        valTotalUSD += cajaVirtual;
        dist['Liquidez'] = (dist['Liquidez'] || 0) + cajaVirtual;
    }

    lista.forEach(x => x.porcentajeCartera = (valTotalUSD > 0) ? x.valorUSD / valTotalUSD : 0);

    if (valFinalRV > 0) cfRV.push({ d: HOY_SIMULADA, v: valFinalRV });
    if (valFinalRF > 0) cfRF.push({ d: HOY_SIMULADA, v: valFinalRF });
    if (valTotalUSD > 0) cfTOTAL.push({ d: HOY_SIMULADA, v: valTotalUSD });

    const hojaEvo = ss.getSheetByName(HOJAS.EVO);
    let valorAyerUSD = obtenerValorAyer(hojaEvo);
    let variacionDiariaReal = (valorAyerUSD > 0) ? (valTotalUSD - valorAyerUSD) : 0;
    let variacionPorcentual = (valorAyerUSD > 0) ? (variacionDiariaReal / valorAyerUSD) : 0;

    const qMetrics = leerQuant(ss.getSheetByName(HOJAS.QUANT));
    const histEvo = leerEvo(hojaEvo);
    const flujosFut = leerProyecciones(ss.getSheetByName(HOJAS.PROY));
    const hPrecios = leerHistPrecios(ss.getSheetByName(HOJAS.HIST)); // versión recortada (150 pts), solo para el gráfico del modal
    const chartAcum = procesarFlujosAcumulativosMensuales(ss.getSheetByName(HOJAS.PROY));
    const chartSem = procesarFlujosSemestrales(ss.getSheetByName(HOJAS.PROY));

    const spyData = precios["INDICE_SPY"] || { var: 0 };
    const alpha = variacionPorcentual - (spyData.var / 100);

    return JSON.stringify({
        kpis: {
            valorTotal: { ars: valTotalUSD * ccl, usd: valTotalUSD },
            variacionDiariaUSD: variacionDiariaReal,
            variacionDiariaPorc: variacionPorcentual,
            gananciasRealizadas: { usd: realizedPL_RV },
            gananciasNoRealizadas: { usd: valorTotalRV - costoTotalRV },
            tirVariable: calcXIRR(cfRV),
            tirFija: calcXIRR(cfRF),
            tirTotal: calcXIRR(cfTOTAL),
            alphaSpy: alpha,
            rentaAnualEstimada: rentaAnualTotalEstimada,
            liquidezDisponible: cajaVirtual,
            currentYieldPortfolio: (valTotalUSD > 0) ? (rentaAnualTotalEstimada / valTotalUSD) : 0,
            cagrHistorico: ((histEvo.fechas.length > 30 && histEvo.valores[0] > 0) ? (Math.pow(histEvo.valores[histEvo.valores.length - 1] / histEvo.valores[0], 1 / ((new Date(histEvo.fechas[histEvo.fechas.length - 1]) - new Date(histEvo.fechas[0])) / (1000 * 60 * 60 * 24 * 365.25))) - 1) : 0),
            yocPromedioPonderado: (costoTotal > 0) ? (rentaAnualTotalEstimada / costoTotal) : 0,
            sortinoRatio: calcSortino(histEvo.valores),
            dividendGrowthRate: calcDGR(statsDivs),
            paybackYears: ((statsDivs.total + statsRenta.total) > 0) ? (costoTotal / (statsDivs.total + statsRenta.total)) : 99,
            nextPay: calcNextPay(flujosFut.porFecha)
        },
        metricasQuant: qMetrics,
        distribucionTipos: dist,
        carteraDetallada: lista,
        mejoresPosiciones: { Cedear: top(lista, "Cedear"), ONs: top(lista, "ONs"), Bonos: top(lista, "Bonos"), Acciones: top(lista, "Acciones") },
        evolucionHistorica: histEvo,
        resumenDividendos: resDivs,
        resumenRentaFija: resRenta,
        flujoFuturoRentaFija: flujosFut,
        flujoAcumulativoMensual: chartAcum,
        flujoSemestral: chartSem,
        historicoPreciosActivos: hPrecios
    });
}
// =================================================================================
// ===  MOTOR.GS — PARTE 2: FUNCIONES AUXILIARES                                ===
// =================================================================================

// XIRR — única implementación en todo el proyecto (reemplaza las 5-6 copias viejas)
function calcXIRR(values, guess = 0.1) {
    if (!values || values.length < 2) return 0;
    let hasPos = false, hasNeg = false;
    for (let x of values) { if (x.v > 0) hasPos = true; if (x.v < 0) hasNeg = true; }
    if (!hasPos || !hasNeg) return 0;
    values.sort((a, b) => a.d - b.d);

    const t0 = values[0].d.getTime();
    const van = (r) => {
        let suma = 0;
        for (let j = 0; j < values.length; j++) {
            const dt = (values[j].d.getTime() - t0) / 31536000000.0;
            const div = Math.pow(1.0 + r, dt);
            if (!div || !isFinite(div)) return NaN;
            suma += values[j].v / div;
        }
        return suma;
    };

    const runNewton = (g) => {
        let x0 = g, x1 = 0.0, tol = 1e-5, maxIter = 50;
        for (let i = 0; i < maxIter; i++) {
            if (x0 <= -1) x0 = -0.99999999;
            let fv = 0.0, fd = 0.0;
            for (let j = 0; j < values.length; j++) {
                let t = values[j].d.getTime();
                let dt = (t - t0) / 31536000000.0;
                if (dt < 0.00001 && j > 0) dt = 0.00001;
                let div = Math.pow(1.0 + x0, dt);
                if (div === 0 || !isFinite(div)) return null;
                fv += values[j].v / div;
                fd -= (dt * values[j].v) / (div * (1.0 + x0));
            }
            if (Math.abs(fd) < 1e-9) return null;
            x1 = x0 - fv / fd;
            if (Math.abs(x1 - x0) <= tol) return x1;
            x0 = x1;
        }
        return null;
    };

    let resultadoNewton = null;
    for (let g of [0.1, -0.5, 0.9, -0.9, 2.0, 0.5, -0.1, -0.2, -0.3, -0.6, -0.7]) {
        let result = runNewton(g);
        if (result !== null && Math.abs(result) < 100 && isFinite(result) && result > -0.999) {
            resultadoNewton = result;
            break;
        }
    }

    if (resultadoNewton !== null) return resultadoNewton;

    let lo = -0.99, hi = 5.0;
    let vanLo = van(lo), vanHi = van(hi);

    if (isNaN(vanLo) || isNaN(vanHi) || (vanLo > 0 && vanHi > 0) || (vanLo < 0 && vanHi < 0)) {
        hi = 50.0;
        vanHi = van(hi);
        if (isNaN(vanHi) || (vanLo > 0 && vanHi > 0) || (vanLo < 0 && vanHi < 0)) {
            return 0;
        }
    }

    let mid = 0, vanMid = 0;
    const maxIterBiseccion = 100;
    const tolBiseccion = 1e-6;

    for (let i = 0; i < maxIterBiseccion; i++) {
        mid = (lo + hi) / 2;
        vanMid = van(mid);

        if (isNaN(vanMid)) { hi = mid; continue; }
        if (Math.abs(vanMid) < tolBiseccion || (hi - lo) / 2 < tolBiseccion) {
            return mid;
        }

        if ((vanLo > 0 && vanMid > 0) || (vanLo < 0 && vanMid < 0)) {
            lo = mid; vanLo = vanMid;
        } else {
            hi = mid; vanHi = vanMid;
        }
    }

    return mid;
}

// -----------------------------------------------------------------------
// COSTO PROMEDIO PONDERADO POR TIEMPO — para el Yield Realizado por año
// -----------------------------------------------------------------------
function calcCostoPromedioPonderado(costoEvents, anio, hoy) {
    const inicioAnio = new Date(anio, 0, 1);
    const finAnio = new Date(anio, 11, 31);
    const corte = (hoy < finAnio) ? hoy : finAnio;
    const diasTranscurridos = Math.floor((corte - inicioAnio) / 86400000) + 1;
    if (diasTranscurridos <= 0 || !costoEvents || costoEvents.length === 0) {
        return { costoProm: 0, dias: 0, esParcial: false };
    }

    let costoActual = 0;
    for (let i = 0; i < costoEvents.length; i++) {
        if (costoEvents[i].d <= inicioAnio) costoActual = costoEvents[i].c;
        else break;
    }

    let puntos = [{ d: inicioAnio, c: costoActual }];
    costoEvents.forEach(e => {
        if (e.d > inicioAnio && e.d <= corte) puntos.push({ d: e.d, c: e.c });
    });
    puntos.push({ d: new Date(corte.getTime() + 86400000), c: null });

    let acumulado = 0;
    for (let i = 0; i < puntos.length - 1; i++) {
        let dias = Math.floor((puntos[i + 1].d - puntos[i].d) / 86400000);
        acumulado += puntos[i].c * dias;
    }

    return {
        costoProm: acumulado / diasTranscurridos,
        dias: diasTranscurridos,
        esParcial: corte < finAnio
    };
}

// Limpieza numérica robusta (formato ARS/USD)
function cleanNum(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let s = String(v).trim().replace('%', '');
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return parseFloat(s) || 0;
}

// Normalización de Tipo_Activo -> categoría estándar (sin "Otro", ya descartado)
function normalizar(t) {
    t = t.toLowerCase();
    if (t.includes('cedear')) return 'Cedear';
    if (t.includes('accion')) return 'Acciones';
    if (t.includes('bono')) return 'Bonos';
    if (t.includes('negociable') || t.includes(' on')) return 'ONs';
    if (t.includes('fci')) return 'FCI';
    if (t.includes('cartera')) return 'Cartera';
    return 'Otros';
}

function top(l, t1, t2) {
    return l.filter(x => x.tipo === t1 || x.tipo === t2)
            .sort((a, b) => b.valorUSD - a.valorUSD)
            .slice(0, 10);
}

function calcSortino(valores) {
    if (!valores || valores.length < 30) return 0;
    const r = [];
    for (let i = 1; i < valores.length; i++) {
        if (valores[i - 1] > 0) r.push((valores[i] - valores[i - 1]) / valores[i - 1]);
    }
    if (r.length === 0) return 0;
    const MAR_ANUAL = 0.05;
    const MAR_DIARIO = MAR_ANUAL / 252;
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    const downside = r.filter(x => x < MAR_DIARIO);
    if (downside.length === 0) return 10;
    const sumSqDown = downside.reduce((a, b) => a + Math.pow(b - MAR_DIARIO, 2), 0);
    const downDev = Math.sqrt(sumSqDown / r.length);
    if (downDev === 0) return 10;
    return ((mean - MAR_DIARIO) * 252) / (downDev * Math.sqrt(252));
}

function calcDGR(stats) {
    const yrs = Object.keys(stats.years).map(y => parseInt(y)).sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    const completedYears = yrs.filter(y => y < currentYear);
    if (completedYears.length < 2) return 0;
    const lastFullY = stats.years[completedYears[0]] || 0;
    const prevFullY = stats.years[completedYears[1]] || 0;
    if (prevFullY === 0) return 1;
    return (lastFullY / prevFullY) - 1;
}

function calcNextPay(lista) {
    if (!lista || lista.length === 0) return { tk: '---', days: 999, amt: 0, renta: 0, capital: 0, count: 0, tickers: [] };
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    let proximaFecha = null;
    for (let f of lista) {
        let d = new Date(f.fecha);
        if (d >= hoy) { proximaFecha = d; break; }
    }
    if (!proximaFecha) return { tk: '---', days: 999, amt: 0, renta: 0, capital: 0, count: 0, tickers: [] };

    let pagosDelDia = lista.filter(f => {
        let d = new Date(f.fecha);
        return d.getTime() === proximaFecha.getTime();
    });

    let totalRenta = 0, totalCapital = 0, tickers = [];
    pagosDelDia.forEach(p => {
        totalRenta += p.renta;
        totalCapital += p.capital;
        tickers.push(p.ticker);
    });

    let diff = Math.ceil((proximaFecha - hoy) / (1000 * 60 * 60 * 24));

    return {
        tk: tickers.join(', '),
        days: diff,
        renta: totalRenta,
        capital: totalCapital,
        amt: totalRenta + totalCapital,
        count: tickers.length,
        tickers: tickers
    };
}

// --- LECTORES DE HOJAS AUXILIARES ---

function leerQuant(h) {
    if (!h) return { volatilidadAnualizada: 0, sharpeRatio: 0, betaCartera: 0, maxDrawdown: 0 };
    const v = h.getRange("H2:H6").getValues();
    return { volatilidadAnualizada: v[1][0], sharpeRatio: v[2][0], betaCartera: v[3][0], maxDrawdown: v[4][0] };
}

function leerEvo(h) {
    if (!h) return { fechas: [], valores: [], benchmark: [] };
    const d = h.getRange("A2:C" + h.getLastRow()).getValues();
    return { fechas: d.map(x => x[0]), valores: d.map(x => x[1]), benchmark: d.map(x => x[2]) };
}

function leerProyecciones(h) {
    if (!h) return { porFecha: [] };
    const d = h.getRange("A2:E" + h.getLastRow()).getValues();
    return { porFecha: d.filter(r => r[4] > 0).map(r => ({ ticker: r[0], fecha: r[1], renta: r[2], capital: r[3] })) };
}

function leerHistPrecios(h) {
    if (!h) return {};
    const d = h.getRange("A2:C" + h.getLastRow()).getValues();
    const rawMap = {};
    for (let i = 0; i < d.length; i++) {
        const r = d[i];
        if (r[1] && r[2] > 0 && r[0] instanceof Date) {
            const tk = String(r[1]).toUpperCase().trim();
            if (!rawMap[tk]) rawMap[tk] = [];
            rawMap[tk].push([r[0].getTime(), r[2]]);
        }
    }
    const finalMap = {};
    const MAX_POINTS = 150;
    Object.keys(rawMap).forEach(tk => {
        let points = rawMap[tk];
        points.sort((a, b) => a[0] - b[0]);
        if (points.length <= MAX_POINTS) {
            finalMap[tk] = points;
        } else {
            const reduced = [];
            const step = Math.ceil(points.length / MAX_POINTS);
            for (let j = 0; j < points.length; j += step) reduced.push(points[j]);
            const lastReal = points[points.length - 1];
            const lastSaved = reduced[reduced.length - 1];
            if (lastReal[0] !== lastSaved[0]) reduced.push(lastReal);
            finalMap[tk] = reduced;
        }
    });
    return finalMap;
}

// -----------------------------------------------------------------------
// Lectura COMPLETA de Historico_Precios, SIN submuestreo — a diferencia de
// leerHistPrecios() (pensada para el gráfico del modal, que sí recorta a
// 150 puntos por ticker), esta función se usa exclusivamente para cálculos
// financieros (Renta Implícita / Modified Dietz) donde necesitamos el
// precio EXACTO de una fecha límite, no una muestra representativa.
// -----------------------------------------------------------------------
function leerHistPreciosCompleto(h) {
    if (!h) return {};
    const d = h.getRange("A2:C" + h.getLastRow()).getValues();
    const rawMap = {};
    for (let i = 0; i < d.length; i++) {
        const r = d[i];
        if (r[1] && r[2] > 0 && r[0] instanceof Date) {
            const tk = String(r[1]).toUpperCase().trim();
            if (!rawMap[tk]) rawMap[tk] = [];
            rawMap[tk].push([r[0].getTime(), r[2]]);
        }
    }
    Object.keys(rawMap).forEach(tk => rawMap[tk].sort((a, b) => a[0] - b[0]));
    return rawMap;
}

function obtenerValorAyer(hoja) {
    if (!hoja) return 0;
    const lastRow = hoja.getLastRow();
    if (lastRow < 2) return 0;
    return parseFloat(hoja.getRange(lastRow, 2).getValue());
}

// --- PROCESADORES DE GRÁFICOS ---

function procesarFlujosAcumulativosMensuales(hoja) {
    if (!hoja) return { labels: [], monthly: [], cumulative: [] };
    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 2) return { labels: [], monthly: [], cumulative: [] };
    const rango = hoja.getRange("A2:E" + ultimaFila).getValues();
    const flujosMensuales = {};
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    rango.forEach(fila => {
        const fecha = new Date(fila[1]);
        const montoTotal = (fila[2] || 0) + (fila[3] || 0);
        if (fecha instanceof Date && !isNaN(fecha) && fecha >= hoy && montoTotal > 0) {
            const mesClave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            flujosMensuales[mesClave] = (flujosMensuales[mesClave] || 0) + montoTotal;
        }
    });
    const mesesOrdenados = Object.keys(flujosMensuales).sort();
    const labels = [], monthlyData = [], cumulativeData = [];
    let acumulado = 0;
    mesesOrdenados.forEach(mesClave => {
        const [ano, mes] = mesClave.split('-');
        const nombreMes = new Date(ano, mes - 1).toLocaleString('es-AR', { month: 'short' });
        labels.push(`${nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}/${ano.slice(2)}`);
        const montoMes = flujosMensuales[mesClave];
        monthlyData.push(montoMes);
        acumulado += montoMes;
        cumulativeData.push(acumulado);
    });
    return { labels, monthly: monthlyData, cumulative: cumulativeData };
}

function procesarFlujosSemestrales(hoja) {
    if (!hoja) return { labels: [], datasets: [] };
    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 2) return { labels: [], datasets: [] };
    const rango = hoja.getRange("A2:E" + ultimaFila).getValues();
    const datosAgregados = {};
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    rango.forEach(fila => {
        const ticker = fila[0];
        const fecha = new Date(fila[1]);
        const montoTotal = (fila[2] || 0) + (fila[3] || 0);
        if (ticker && fecha instanceof Date && !isNaN(fecha) && fecha >= hoy && montoTotal > 0) {
            const ano = fecha.getFullYear().toString().slice(-2);
            const semestreLabel = fecha.getMonth() < 6 ? `Ene/${ano}` : `Jul/${ano}`;
            if (!datosAgregados[semestreLabel]) datosAgregados[semestreLabel] = {};
            datosAgregados[semestreLabel][ticker] = (datosAgregados[semestreLabel][ticker] || 0) + montoTotal;
        }
    });
    const labels = Object.keys(datosAgregados).sort((a, b) => {
        const [m1, y1] = a.split('/'); const [m2, y2] = b.split('/');
        if (y1 !== y2) return parseInt(y1) - parseInt(y2);
        return m1 === 'Ene' ? -1 : 1;
    });
    const tickersUnicos = [...new Set(rango.map(fila => fila[0]).filter(Boolean))];
    const datasets = tickersUnicos.map(ticker => {
        const data = labels.map(label => datosAgregados[label][ticker] || 0);
        return { label: ticker, data: data };
    }).filter(ds => ds.data.some(d => d > 0));
    return { labels, datasets };
}

// -----------------------------------------------------------------------
// ACTUALIZADOR DE UNIVERSO DE TICKERS
// -----------------------------------------------------------------------
function calcularCantidadesNetas() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logData = ss.getSheetByName(HOJAS.LOG).getDataRange().getValues();
    const logSinHeader = logData.slice(1);
    logSinHeader.sort((a, b) => new Date(a[1]) - new Date(b[1]));

    let cantidades = {};

    for (let i = 0; i < logSinHeader.length; i++) {
        const row = logSinHeader[i];
        const ticker = String(row[3]).toUpperCase().trim();
        const tipoStr = String(row[4]);
        const mov = String(row[5]).toLowerCase().trim();
        const cant = cleanNum(row[6]);
        const ratioSplit = cleanNum(row[11]);

        if (!ticker) continue;
        if (ticker === 'USD' || ticker === 'CASH') continue;

        if (!cantidades[ticker]) cantidades[ticker] = { q: 0, tipo: tipoStr };

        if (mov.includes('compra') || mov.includes('aporte') || mov.includes('suscripcion') || mov.includes('canje_entrada')) {
            cantidades[ticker].q += cant;
        } else if (mov.includes('venta') || mov.includes('rescate') || mov.includes('canje_salida')) {
            cantidades[ticker].q -= cant;
        } else if (mov.includes('split')) {
            if (ratioSplit > 0 && cantidades[ticker].q > 0) cantidades[ticker].q *= ratioSplit;
        }
        cantidades[ticker].tipo = tipoStr;
    }

    return cantidades;
}

function actualizarUniversoTickers() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaCartera = ss.getSheetByName(HOJAS.CARTERA);
    if (!hojaCartera) { console.error("No se encontró 'Cartera'"); return; }

    const cantidades = calcularCantidadesNetas();

    const ordenTipos = ["Cedear", "Acciones", "Bonos", "O Negociable", "FCI", "Cartera admin", "Liquidez"];

    let porTipo = {};
    ordenTipos.forEach(t => porTipo[t] = []);

    Object.keys(cantidades).forEach(tk => {
        const item = cantidades[tk];
        if (item.q <= 0.01) return;

        const tNorm = normalizar(item.tipo);
        let etiqueta = null;
        if (tNorm === 'Cedear') etiqueta = 'Cedear';
        else if (tNorm === 'Acciones') etiqueta = 'Acciones';
        else if (tNorm === 'Bonos') etiqueta = 'Bonos';
        else if (tNorm === 'ONs') etiqueta = 'O Negociable';
        else if (tNorm === 'FCI') etiqueta = 'FCI';
        else if (tNorm === 'Cartera') etiqueta = 'Cartera admin';
        else etiqueta = 'Liquidez';

        if (porTipo[etiqueta]) porTipo[etiqueta].push(tk);
    });

    let filas = [];
    ordenTipos.forEach(tipo => {
        const tickersOrdenados = porTipo[tipo].sort();
        tickersOrdenados.forEach(tk => filas.push([tk, tipo]));
    });

    const COL_W = 23, COL_X = 24;
    const ultimaFilaVieja = hojaCartera.getLastRow();
    if (ultimaFilaVieja >= 2) {
        hojaCartera.getRange(2, COL_W, Math.max(ultimaFilaVieja - 1, 1), 2).clearContent();
    }

    if (filas.length > 0) {
        hojaCartera.getRange(2, COL_W, filas.length, 2).setValues(filas);
    }

    const FILA_USD = 90;
    const ccl = obtenerCCLActual();
    const cajaVirtual = calcularCajaVirtual();

    hojaCartera.getRange(FILA_USD, COL_W, 1, 2).setValues([["USD", "Liquidez"]]);
    hojaCartera.getRange(FILA_USD, 25, 1, 5).setValues([[
        cajaVirtual,
        ccl,
        cajaVirtual * ccl,
        cajaVirtual,
        cajaVirtual
    ]]);

    console.log(`✅ Universo de tickers actualizado: ${filas.length} tickers vivos + fila USD (fila ${FILA_USD}) | ${Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm:ss")}`);
}

function obtenerCCLActual() {
    let ccl = 1000;
    try {
        const val = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJAS.PRECIOS).getRange("B4").getValue();
        if (typeof val === 'number' && val > 500) ccl = val;
    } catch (e) { }
    return ccl;
}

function instalarTriggerUniversoTickers() {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'actualizarUniversoTickers').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('actualizarUniversoTickers').timeBased().everyMinutes(15).create();
    console.log("✅ Trigger Universo de Tickers instalado: cada 15 minutos.");
}

// -----------------------------------------------------------------------
// ESCRITOR DE XIRR EN CARTERA
// -----------------------------------------------------------------------
function actualizarXirrCartera() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaCartera = ss.getSheetByName(HOJAS.CARTERA);
    if (!hojaCartera) { console.error("No se encontró 'Cartera'"); return; }

    const logData = ss.getSheetByName(HOJAS.LOG).getDataRange().getValues();
    const logSinHeader = logData.slice(1);
    logSinHeader.sort((a, b) => new Date(a[1]) - new Date(b[1]));

    let cashflowsPorTicker = {};
    let cantidadesActuales = {};

    for (let i = 0; i < logSinHeader.length; i++) {
        const row = logSinHeader[i];
        const fecha = new Date(row[1]);
        const ticker = String(row[3]).toUpperCase().trim();
        const mov = String(row[5]).toLowerCase().trim();
        const cant = cleanNum(row[6]);
        const montoUSD = Math.abs(cleanNum(row[10]));
        const ratioSplit = cleanNum(row[11]);

        if (!ticker) continue;
        if (ticker === 'USD' || ticker === 'CASH') continue;

        if (!cashflowsPorTicker[ticker]) cashflowsPorTicker[ticker] = [];
        if (!cantidadesActuales[ticker]) cantidadesActuales[ticker] = 0;

        if (mov.includes('compra') || mov.includes('aporte') || mov.includes('suscripcion') || mov.includes('canje_entrada')) {
            cashflowsPorTicker[ticker].push({ d: fecha, v: -montoUSD });
            cantidadesActuales[ticker] += cant;
        } else if (mov.includes('venta') || mov.includes('rescate') || mov.includes('canje_salida')) {
            cashflowsPorTicker[ticker].push({ d: fecha, v: montoUSD });
            cantidadesActuales[ticker] -= cant;
        } else if (mov.includes('dividendo') || mov.includes('renta') || mov.includes('interes') || mov.includes('amortiza')) {
            cashflowsPorTicker[ticker].push({ d: fecha, v: montoUSD });
        } else if (mov.includes('split')) {
            if (ratioSplit > 0 && cantidadesActuales[ticker] > 0) cantidadesActuales[ticker] *= ratioSplit;
        }
    }

    const columnaA = hojaCartera.getRange("A2:A" + hojaCartera.getMaxRows()).getValues();
    let ultimaFilaConTicker = 0;
    for (let i = 0; i < columnaA.length; i++) {
        if (String(columnaA[i][0]).trim() !== "") ultimaFilaConTicker = i + 1;
    }
    if (ultimaFilaConTicker === 0) { console.warn("Cartera vacía (columna A)"); return; }

    const dataCartera = hojaCartera.getRange(2, 1, ultimaFilaConTicker, 6).getValues();
    let resultados = [];

    dataCartera.forEach(row => {
        const ticker = String(row[0]).toUpperCase().trim();
        const valorActualUSD = cleanNum(row[5]);

        if (!ticker || !cashflowsPorTicker[ticker]) { resultados.push(0); return; }

        const cfs = [...cashflowsPorTicker[ticker]];
        if (cantidadesActuales[ticker] > 0.01 && valorActualUSD > 0) {
            cfs.push({ d: new Date(), v: valorActualUSD });
        }

        const xirr = calcXIRR(cfs);
        resultados.push(xirr);
    });

    hojaCartera.getRange(2, 9, resultados.length, 1).setValues(resultados.map(x => [x]));
    hojaCartera.getRange(2, 9, resultados.length, 1).setNumberFormat("0.00%");

    console.log(`✅ XIRR actualizado en Cartera para ${resultados.length} tickers.`);
}

function instalarTriggerXirrCartera() {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'actualizarXirrCartera').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('actualizarXirrCartera').timeBased().everyMinutes(15).create();
    console.log("✅ Trigger XIRR Cartera instalado: cada 15 minutos.");
}

// -----------------------------------------------------------------------
// CAJA VIRTUAL
// -----------------------------------------------------------------------
function calcularCajaVirtual() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logData = ss.getSheetByName(HOJAS.LOG).getDataRange().getValues();
    const logSinHeader = logData.slice(1);

    let cajaVirtual = SALDO_INICIAL_CAJA;

    logSinHeader.forEach(row => {
        const fecha = new Date(row[1]);
        if (isNaN(fecha.getTime()) || fecha < FECHA_CORTE_CAJA) return;

        const mov = String(row[5]).toLowerCase().trim();
        const montoUSD = Math.abs(cleanNum(row[10]));

        if (mov.includes('compra') || mov.includes('retiro') || mov.includes('canje_entrada')) {
            cajaVirtual -= montoUSD;
        } else if (mov.includes('venta') || mov.includes('rescate') || mov.includes('aporte') ||
                   mov.includes('dividendo') || mov.includes('renta') || mov.includes('interes') ||
                   mov.includes('amortiza') || mov.includes('canje_salida')) {
            cajaVirtual += montoUSD;
        }
    });

    return cajaVirtual;
}