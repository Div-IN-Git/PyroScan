(function () {
  function classifyRiskIndex(riskIndex) {
    const value = Number(riskIndex);
    if (!Number.isFinite(value)) return "Unknown";
    if (value < 0.3) return "Low";
    if (value < 0.5) return "Moderate";
    if (value < 0.7) return "High";
    return "Extreme";
  }

  function sanitizeFilename(value, fallback) {
    const clean = String(value || fallback || "Region")
      .trim()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    return clean || fallback || "Region";
  }

  function formatPercent(value) {
    const safe = Number(value);
    if (!Number.isFinite(safe)) return "N/A";
    return `${Math.round(safe * 100)}%`;
  }

  function computeSpreadProbability(signals) {
    const thermal = Number(signals?.thermal || 0);
    const vegetation = Number(signals?.vegetation || 0);
    const wind = Number(signals?.wind || 0);
    const human = Number(signals?.human || 0);
    const weighted = thermal * 0.35 + vegetation * 0.25 + wind * 0.25 + human * 0.15;
    return Math.max(0, Math.min(1, weighted));
  }

  function getPreparednessRecommendations(riskClass) {
    if (riskClass === "Low") {
      return [
        "Maintain routine patrol and remote monitoring.",
        "Keep communication channels open for local alerts.",
        "Review evacuation signage and public notices monthly.",
      ];
    }
    if (riskClass === "Moderate") {
      return [
        "Increase observation cadence in high-vegetation edges.",
        "Pre-stage rapid response tools near risk corridors.",
        "Run community awareness updates for smoke and spark prevention.",
      ];
    }
    if (riskClass === "High") {
      return [
        "Activate enhanced patrol rotations and thermal checks.",
        "Position fire crews and water assets close to hotspots.",
        "Issue precautionary advisories for outdoor ignition risks.",
      ];
    }
    if (riskClass === "Extreme") {
      return [
        "Trigger pre-emergency wildfire response protocols.",
        "Restrict high-risk field operations and open-fire activities.",
        "Coordinate with local authorities for readiness and possible evacuation.",
      ];
    }
    return ["Collect more data to generate recommendations."];
  }

  function toDateStamp(dateObj) {
    const d = dateObj || new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function saveBlob(blob, filename) {
    if (typeof window.saveAs === "function") {
      window.saveAs(blob, filename);
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function getCurrentPayload() {
    if (window.PyroScan && typeof window.PyroScan.getCurrentRiskData === "function") {
      return window.PyroScan.getCurrentRiskData() || {};
    }
    return window.riskData || {};
  }

  async function generateRiskReportPDF(regionName, riskData) {
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) {
      throw new Error("jsPDF is not loaded.");
    }

    const payload = riskData || {};
    const region = regionName || payload.region || "Unknown Region";
    const reportDate = new Date();
    const riskIndex = Number(payload.riskIndex || 0);
    const riskClass = payload.classification || classifyRiskIndex(riskIndex);
    const signals = payload.signals || payload.factors || {};
    const spreadProbability = Number.isFinite(payload.spreadProbability)
      ? payload.spreadProbability
      : computeSpreadProbability(signals);
    const forecast = Array.isArray(payload.forecast7DaySummary)
      ? payload.forecast7DaySummary
      : Array.isArray(payload.forecast)
      ? payload.forecast.slice(0, 7)
      : [];

    const pdf = new jsPDFCtor({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 48;
    let y = 56;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("Wildfire Risk Assessment Report", margin, y);

    y += 28;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Region: ${region}`, margin, y);
    y += 18;
    pdf.text(`Date: ${reportDate.toLocaleString()}`, margin, y);

    y += 26;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Risk Summary", margin, y);

    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Overall Risk Index: ${riskIndex.toFixed(2)} (${formatPercent(riskIndex)})`, margin, y);
    y += 16;
    pdf.text(`Risk Classification: ${riskClass}`, margin, y);
    y += 16;
    pdf.text(`Spread Probability: ${formatPercent(spreadProbability)}`, margin, y);

    y += 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Contributing Factors", margin, y);

    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Thermal Anomaly: ${formatPercent(signals.thermal)}`, margin, y);
    y += 16;
    pdf.text(`Vegetation Stress: ${formatPercent(signals.vegetation)}`, margin, y);
    y += 16;
    pdf.text(`Wind Amplifier: ${formatPercent(signals.wind)}`, margin, y);
    y += 16;
    pdf.text(`Human Proximity: ${formatPercent(signals.human)}`, margin, y);

    y += 24;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("7-Day Forecast Summary", margin, y);

    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    if (forecast.length === 0) {
      pdf.text("No forecast data available.", margin, y);
      y += 16;
    } else {
      forecast.forEach((entry, index) => {
        if (y > 730) {
          pdf.addPage();
          y = 56;
        }
        const line = `Day ${entry.day || index + 1} (${entry.date || "N/A"}) - ${
          Number.isFinite(entry.riskIndex) ? entry.riskIndex.toFixed(2) : "N/A"
        } (${entry.classification || classifyRiskIndex(entry.riskIndex)})`;
        pdf.text(line, margin, y);
        y += 15;
      });
    }

    y += 16;
    if (y > 700) {
      pdf.addPage();
      y = 56;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Preparedness Recommendations", margin, y);

    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    getPreparednessRecommendations(riskClass).forEach((tip) => {
      if (y > 760) {
        pdf.addPage();
        y = 56;
      }
      pdf.text(`- ${tip}`, margin, y, { maxWidth: pageWidth - margin * 2 });
      y += 16;
    });

    const mapElement =
      (window.PyroScan && typeof window.PyroScan.getMapElement === "function"
        ? window.PyroScan.getMapElement()
        : null) || document.getElementById("map");

    if (mapElement && typeof window.html2canvas === "function") {
      try {
        if (y > 560) {
          pdf.addPage();
          y = 56;
        }
        const mapCanvas = await window.html2canvas(mapElement, {
          useCORS: true,
          backgroundColor: null,
          logging: false,
          scale: 1,
        });
        const targetWidth = pageWidth - margin * 2;
        const targetHeight = (mapCanvas.height * targetWidth) / mapCanvas.width;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text("Map Snapshot", margin, y);
        y += 10;
        pdf.addImage(
          mapCanvas.toDataURL("image/png"),
          "PNG",
          margin,
          y,
          targetWidth,
          Math.min(targetHeight, 260)
        );
      } catch (error) {
        // Keep PDF generation resilient if map capture fails.
      }
    }

    const analyticsImages =
      window.PyroScanAnalytics &&
      typeof window.PyroScanAnalytics.getChartImages === "function"
        ? window.PyroScanAnalytics.getChartImages()
        : [];

    if (Array.isArray(analyticsImages) && analyticsImages.length) {
      try {
        pdf.addPage();
        y = 56;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("Risk Analytics Graphs", margin, y);
        y += 18;

        analyticsImages.forEach((item) => {
          const title = item?.title || "Analytics Chart";
          const imageData = item?.dataUrl;
          if (!imageData) return;

          const chartWidth = pageWidth - margin * 2;
          const chartHeight = 180;

          if (y + chartHeight + 34 > 792) {
            pdf.addPage();
            y = 56;
          }

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.text(title, margin, y);
          y += 10;
          pdf.addImage(imageData, "PNG", margin, y, chartWidth, chartHeight);
          y += chartHeight + 16;
        });
      } catch (error) {
        // Keep PDF generation resilient if chart embedding fails.
      }
    }

    const filename = `Wildfire_Risk_Report_${sanitizeFilename(region, "Region")}_${toDateStamp(
      reportDate
    )}.pdf`;
    pdf.save(filename);
    return filename;
  }

  function exportRiskCSV(riskTiles, regionName) {
    const tiles = Array.isArray(riskTiles) ? riskTiles : [];
    const region = regionName || getCurrentPayload().region || "Region";

    const header = [
      "Tile_ID",
      "Latitude",
      "Longitude",
      "Risk_Score",
      "Risk_Category",
      "Thermal_Anomaly",
      "Vegetation_Stress",
      "Wind_Amplifier",
      "Human_Proximity",
      "Spread_Probability",
    ];

    const rows = tiles.map((tile, index) => {
      const tileId = tile.tileId || tile.tile_id || `tile_${index + 1}`;
      const riskScore = Number(tile.riskScore ?? tile.risk_score ?? 0);
      const thermal = Number(tile.thermalAnomaly ?? tile.thermal ?? 0);
      const vegetation = Number(tile.vegetationStress ?? tile.vegetation ?? 0);
      const wind = Number(tile.windAmplifier ?? tile.wind ?? 0);
      const human = Number(tile.humanProximity ?? tile.human ?? 0);
      const spreadProbability = Number(
        tile.spreadProbability ??
          (thermal * 0.35 + vegetation * 0.25 + wind * 0.25 + human * 0.15)
      );

      return [
        tileId,
        Number(tile.latitude ?? tile.lat ?? 0).toFixed(5),
        Number(tile.longitude ?? tile.lon ?? 0).toFixed(5),
        Number.isFinite(riskScore) ? riskScore.toFixed(4) : "0.0000",
        tile.riskCategory || tile.risk_category || classifyRiskIndex(riskScore),
        Number.isFinite(thermal) ? thermal.toFixed(4) : "0.0000",
        Number.isFinite(vegetation) ? vegetation.toFixed(4) : "0.0000",
        Number.isFinite(wind) ? wind.toFixed(4) : "0.0000",
        Number.isFinite(human) ? human.toFixed(4) : "0.0000",
        Number.isFinite(spreadProbability) ? spreadProbability.toFixed(4) : "0.0000",
      ];
    });

    const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const filename = `risk_tiles_${sanitizeFilename(region, "Region")}.csv`;
    saveBlob(blob, filename);
    return filename;
  }

  function exportRiskJSON(riskData) {
    const payload = riskData || getCurrentPayload() || {};
    const region = payload.region || "Region";
    const output = {
      region,
      riskIndex: Number(payload.riskIndex || 0),
      classification: payload.classification || classifyRiskIndex(payload.riskIndex || 0),
      forecast: Array.isArray(payload.forecast) ? payload.forecast : [],
      riskTiles: Array.isArray(payload.riskTiles)
        ? payload.riskTiles
        : Array.isArray(payload.tiles)
        ? payload.tiles
        : [],
      timestamp: payload.timestamp || new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const filename = `risk_data_${sanitizeFilename(region, "Region")}.json`;
    saveBlob(blob, filename);
    return filename;
  }

  function getButton(id) {
    return document.getElementById(id);
  }

  function getLoaderElement() {
    return document.getElementById("downloadLoading");
  }

  function setLoadingState(isLoading, message) {
    const loader = getLoaderElement();
    if (!loader) return;

    loader.classList.toggle("is-visible", Boolean(isLoading));
    loader.textContent = message || (isLoading ? "Generating file..." : "");
  }

  async function runWithLoading(action, message) {
    const buttons = [
      "downloadRiskReportBtn",
      "exportRiskCsvBtn",
      "exportRiskJsonBtn",
    ]
      .map(getButton)
      .filter(Boolean);

    try {
      buttons.forEach((btn) => {
        btn.disabled = true;
      });
      setLoadingState(true, message);
      await action();
      setLoadingState(true, "Download started.");
      setTimeout(() => setLoadingState(false, ""), 1000);
    } catch (error) {
      setLoadingState(true, error?.message || "Could not generate file.");
      setTimeout(() => setLoadingState(false, ""), 2200);
    } finally {
      buttons.forEach((btn) => {
        btn.disabled = false;
      });
    }
  }

  function initDownloadIntelligence() {
    const reportBtn = getButton("downloadRiskReportBtn");
    const csvBtn = getButton("exportRiskCsvBtn");
    const jsonBtn = getButton("exportRiskJsonBtn");

    if (!reportBtn || !csvBtn || !jsonBtn) {
      return;
    }

    reportBtn.addEventListener("click", () => {
      const payload = getCurrentPayload();
      runWithLoading(
        () => generateRiskReportPDF(payload.region, payload),
        "Generating wildfire risk report..."
      );
    });

    csvBtn.addEventListener("click", () => {
      const payload = getCurrentPayload();
      runWithLoading(
        () => Promise.resolve(exportRiskCSV(payload.riskTiles || payload.tiles, payload.region)),
        "Preparing CSV export..."
      );
    });

    jsonBtn.addEventListener("click", () => {
      const payload = getCurrentPayload();
      runWithLoading(
        () => Promise.resolve(exportRiskJSON(payload)),
        "Preparing JSON export..."
      );
    });
  }

  window.DownloadIntelligence = {
    classifyRiskIndex,
    generateRiskReportPDF,
    exportRiskCSV,
    exportRiskJSON,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDownloadIntelligence);
  } else {
    initDownloadIntelligence();
  }
})();
