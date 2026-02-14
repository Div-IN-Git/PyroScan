(function () {
  const CATEGORY_ORDER = ["Safe", "Guarded", "Elevated", "High", "Extreme"];
  const FACTOR_KEYS = ["thermal", "vegetation", "wind", "human"];
  const FACTOR_LABELS = ["Thermal", "Vegetation", "Wind", "Human"];
  const FORECAST_LABELS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
  const CATEGORY_COLORS = ["#3ddc84", "#9be45b", "#ffc857", "#ff7f50", "#9c1127"];
  const FACTOR_COLORS = ["#ffb347", "#ff8f3f", "#ff6f3c", "#ff4d3a"];

  const chartState = {
    factor: null,
    category: null,
    forecast: null,
  };

  let currentPayload = null;
  let analyticsStatusTimer = null;

  function safeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sanitizeFilename(value, fallback) {
    const cleaned = String(value || fallback || "region")
      .trim()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned || fallback || "region";
  }

  function getPayloadFromApp() {
    if (window.PyroScan && typeof window.PyroScan.getCurrentRiskData === "function") {
      return window.PyroScan.getCurrentRiskData() || {};
    }
    return window.riskData || {};
  }

  function toForecastValues(source) {
    if (!Array.isArray(source)) return [];
    return source
      .slice(0, 7)
      .map((entry) => {
        if (typeof entry === "number") {
          return clamp(safeNumber(entry, 0), 0, 1);
        }
        const value = safeNumber(entry?.riskIndex ?? entry?.value ?? entry?.score, 0);
        return clamp(value, 0, 1);
      });
  }

  function normalizeRiskData(input) {
    const raw = input && typeof input === "object" ? input : {};
    const factorsInput = raw.factors || raw.signals || {};
    const tilesInput = Array.isArray(raw.tiles)
      ? raw.tiles
      : Array.isArray(raw.riskTiles)
      ? raw.riskTiles
      : [];
    const forecastSource =
      Array.isArray(raw.forecast7DaySummary) && raw.forecast7DaySummary.length
        ? raw.forecast7DaySummary
        : raw.forecast;

    const forecastValues = toForecastValues(forecastSource);
    while (forecastValues.length < 7) {
      forecastValues.push(null);
    }

    return {
      region: raw.region || raw.regionName || "Region",
      riskIndex: clamp(safeNumber(raw.riskIndex, 0), 0, 1),
      factors: {
        thermal: clamp(safeNumber(factorsInput.thermal, 0), 0, 1),
        vegetation: clamp(safeNumber(factorsInput.vegetation, 0), 0, 1),
        wind: clamp(safeNumber(factorsInput.wind, 0), 0, 1),
        human: clamp(safeNumber(factorsInput.human, 0), 0, 1),
      },
      forecastValues,
      tiles: tilesInput,
    };
  }

  function getFactorPercentages(factors) {
    const values = FACTOR_KEYS.map((key) => clamp(safeNumber(factors?.[key], 0), 0, 1));
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return [0, 0, 0, 0];
    return values.map((value) => Number(((value / total) * 100).toFixed(1)));
  }

  function normalizeCategory(category) {
    const value = String(category || "")
      .trim()
      .toLowerCase();
    if (!value) return "";
    if (value === "safe" || value === "low") return "Safe";
    if (value === "guarded" || value === "moderate" || value === "medium") return "Guarded";
    if (value === "elevated") return "Elevated";
    if (value === "high") return "High";
    if (value === "extreme" || value === "critical" || value === "very high") return "Extreme";
    return "";
  }

  function scoreToCategory(score) {
    const value = safeNumber(score, 0);
    if (value <= 0.25) return "Safe";
    if (value <= 0.45) return "Guarded";
    if (value <= 0.6) return "Elevated";
    if (value <= 0.8) return "High";
    return "Extreme";
  }

  function getCategoryCounts(tiles) {
    const counts = {
      Safe: 0,
      Guarded: 0,
      Elevated: 0,
      High: 0,
      Extreme: 0,
    };

    const entries = Array.isArray(tiles) ? tiles : [];
    entries.forEach((tile) => {
      const byLabel = normalizeCategory(tile?.category || tile?.riskCategory || tile?.risk_category);
      if (byLabel) {
        counts[byLabel] += 1;
        return;
      }
      const score = tile?.riskScore ?? tile?.risk_score ?? tile?.value ?? tile?.intensity;
      counts[scoreToCategory(score)] += 1;
    });

    return CATEGORY_ORDER.map((label) => counts[label]);
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function setAnalyticsStatus(message, keepVisible = false) {
    const status = getElement("analyticsStatus");
    if (!status) return;

    if (analyticsStatusTimer) {
      window.clearTimeout(analyticsStatusTimer);
      analyticsStatusTimer = null;
    }

    status.textContent = message || "";
    status.classList.toggle("is-visible", Boolean(message));

    if (message && !keepVisible) {
      analyticsStatusTimer = window.setTimeout(() => {
        status.textContent = "";
        status.classList.remove("is-visible");
      }, 1700);
    }
  }

  function setButtonsDisabled(disabled) {
    [
      "downloadRiskFactorChartBtn",
      "downloadRiskCategoryChartBtn",
      "downloadForecastTrendChartBtn",
      "downloadAllGraphsPdfBtn",
    ].forEach((id) => {
      const button = getElement(id);
      if (button) {
        button.disabled = disabled;
      }
    });
  }

  function createFactorChart(canvas) {
    return new window.Chart(canvas, {
      type: "bar",
      data: {
        labels: FACTOR_LABELS,
        datasets: [
          {
            data: [0, 0, 0, 0],
            borderRadius: 8,
            borderSkipped: false,
            backgroundColor: FACTOR_COLORS,
            borderColor: FACTOR_COLORS,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.parsed.y}%`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#d8e3ef" },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: "#d8e3ef",
              callback(value) {
                return `${value}%`;
              },
            },
            grid: { color: "rgba(255,255,255,0.1)" },
          },
        },
      },
    });
  }

  function createCategoryChart(canvas) {
    return new window.Chart(canvas, {
      type: "pie",
      data: {
        labels: CATEGORY_ORDER,
        datasets: [
          {
            data: [0, 0, 0, 0, 0],
            backgroundColor: CATEGORY_COLORS,
            borderColor: "rgba(10, 16, 24, 0.95)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#d8e3ef",
              boxWidth: 10,
              boxHeight: 10,
            },
          },
        },
      },
    });
  }

  function createForecastChart(canvas) {
    return new window.Chart(canvas, {
      type: "line",
      data: {
        labels: FORECAST_LABELS,
        datasets: [
          {
            data: [null, null, null, null, null, null, null],
            label: "Risk Index",
            borderColor: "#ff7a1a",
            backgroundColor: "rgba(255, 122, 26, 0.18)",
            pointBackgroundColor: "#ffd37a",
            pointRadius: 3,
            pointHoverRadius: 4,
            borderWidth: 2,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = safeNumber(context.parsed.y, 0);
                return `Risk Index: ${value.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#d8e3ef" },
            grid: { color: "rgba(255,255,255,0.08)" },
          },
          y: {
            min: 0,
            max: 1,
            ticks: {
              color: "#d8e3ef",
              callback(value) {
                return Number(value).toFixed(2);
              },
            },
            grid: { color: "rgba(255,255,255,0.1)" },
          },
        },
      },
    });
  }

  function ensureCharts() {
    if (!window.Chart) {
      setAnalyticsStatus("Chart.js failed to load.", true);
      return false;
    }

    const factorCanvas = getElement("riskFactorChart");
    const categoryCanvas = getElement("riskCategoryChart");
    const forecastCanvas = getElement("forecastTrendChart");

    if (!factorCanvas || !categoryCanvas || !forecastCanvas) {
      return false;
    }

    if (!chartState.factor) {
      chartState.factor = createFactorChart(factorCanvas);
    }
    if (!chartState.category) {
      chartState.category = createCategoryChart(categoryCanvas);
    }
    if (!chartState.forecast) {
      chartState.forecast = createForecastChart(forecastCanvas);
    }

    return true;
  }

  function updateCharts(payloadInput) {
    if (!ensureCharts()) return;

    currentPayload = normalizeRiskData(payloadInput);
    const factorPercentages = getFactorPercentages(currentPayload.factors);
    const categoryCounts = getCategoryCounts(currentPayload.tiles);

    chartState.factor.data.datasets[0].data = factorPercentages;
    chartState.factor.update();

    chartState.category.data.datasets[0].data = categoryCounts;
    chartState.category.update();

    chartState.forecast.data.datasets[0].data = currentPayload.forecastValues;
    chartState.forecast.update();
  }

  function downloadChart(chartInstance, filename) {
    const link = document.createElement("a");
    link.href = chartInstance.toBase64Image();
    link.download = filename;
    link.click();
  }

  function getChartImages() {
    const images = [];
    if (chartState.factor) {
      images.push({
        title: "Risk Factor Contribution",
        dataUrl: chartState.factor.toBase64Image(),
      });
    }
    if (chartState.category) {
      images.push({
        title: "Risk Category Distribution",
        dataUrl: chartState.category.toBase64Image(),
      });
    }
    if (chartState.forecast) {
      images.push({
        title: "7-Day Forecast Trend",
        dataUrl: chartState.forecast.toBase64Image(),
      });
    }
    return images;
  }

  async function downloadAllGraphsPdf() {
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) {
      throw new Error("jsPDF is not loaded.");
    }

    const images = getChartImages();
    if (!images.length) {
      throw new Error("Charts are not ready yet.");
    }

    const pdf = new jsPDFCtor({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 44;
    let y = 56;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(19);
    pdf.text("Wildfire Analytics Graph Report", margin, y);

    y += 18;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Region: ${(currentPayload && currentPayload.region) || "Region"}`, margin, y);
    y += 16;
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 24;

    images.forEach((image, index) => {
      if (index > 0) {
        pdf.addPage();
        y = 56;
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(image.title, margin, y);
      y += 12;

      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - y - margin;
      const height = Math.min(availableHeight, availableWidth * 0.58);
      pdf.addImage(image.dataUrl, "PNG", margin, y, availableWidth, height);
      y += height + 12;
    });

    const regionPart = sanitizeFilename(
      (currentPayload && currentPayload.region) || "Region",
      "Region"
    );
    const filename = `wildfire_analytics_report_${regionPart}.pdf`;
    pdf.save(filename);
    return filename;
  }

  function bindDownloadButtons() {
    const factorBtn = getElement("downloadRiskFactorChartBtn");
    const categoryBtn = getElement("downloadRiskCategoryChartBtn");
    const forecastBtn = getElement("downloadForecastTrendChartBtn");
    const allPdfBtn = getElement("downloadAllGraphsPdfBtn");

    if (factorBtn) {
      factorBtn.addEventListener("click", () => {
        if (!chartState.factor) {
          setAnalyticsStatus("Chart not ready yet.", true);
          return;
        }
        const regionPart = sanitizeFilename(currentPayload?.region || "Region", "Region");
        downloadChart(chartState.factor, `risk_factor_contribution_${regionPart}.png`);
      });
    }

    if (categoryBtn) {
      categoryBtn.addEventListener("click", () => {
        if (!chartState.category) {
          setAnalyticsStatus("Chart not ready yet.", true);
          return;
        }
        const regionPart = sanitizeFilename(currentPayload?.region || "Region", "Region");
        downloadChart(chartState.category, `risk_category_distribution_${regionPart}.png`);
      });
    }

    if (forecastBtn) {
      forecastBtn.addEventListener("click", () => {
        if (!chartState.forecast) {
          setAnalyticsStatus("Chart not ready yet.", true);
          return;
        }
        const regionPart = sanitizeFilename(currentPayload?.region || "Region", "Region");
        downloadChart(chartState.forecast, `seven_day_forecast_trend_${regionPart}.png`);
      });
    }

    if (allPdfBtn) {
      allPdfBtn.addEventListener("click", async () => {
        try {
          setButtonsDisabled(true);
          setAnalyticsStatus("Generating analytics PDF...", true);
          await downloadAllGraphsPdf();
          setAnalyticsStatus("Analytics PDF download started.");
        } catch (error) {
          setAnalyticsStatus(error?.message || "Could not export analytics PDF.", true);
        } finally {
          setButtonsDisabled(false);
        }
      });
    }
  }

  function handleRiskDataUpdate(event) {
    const payload = event?.detail?.riskData || getPayloadFromApp();
    updateCharts(payload);
  }

  function initAnalytics() {
    bindDownloadButtons();
    updateCharts(getPayloadFromApp());
    document.addEventListener("pyroscan:risk-updated", handleRiskDataUpdate);
  }

  window.PyroScanAnalytics = {
    updateCharts,
    getChartImages,
    downloadChart,
    downloadAllGraphsPdf,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAnalytics);
  } else {
    initAnalytics();
  }
})();
