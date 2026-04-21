// Brainwave data fetching and display functionality with fortune integration

const weighting_power = 0.57;
const dominant_cutoff = 0.2;

// Multi-sine wave brainwave generation with frequency weighting
function generateFrequencyWeightedWave(brainwaveType, amplitude, width = 80, height = 60) {
    const points = [];
    const centerY = height / 2;
    const maxAmplitude = height / 3;
    
    // Define frequency ranges for each brainwave type (in Hz)
    const brainwaveSpecs = {
        delta: { minHz: 0.5, maxHz:   4, centerHz: 2.25, numWaves: 7 },
        theta: { minHz:   4, maxHz:   8, centerHz:    6, numWaves: 13 },
        alpha: { minHz:   8, maxHz:  12, centerHz:   10, numWaves: 8 },
        beta:  { minHz:  12, maxHz:  30, centerHz:   21, numWaves: 10 },
        gamma: { minHz:  30, maxHz: 100, centerHz:   65, numWaves: 2 }
    };
    
    const spec = brainwaveSpecs[brainwaveType];
    if (!spec) return `M0,${centerY} L${width},${centerY}`;
    
    // Generate frequency components with weighted amplitudes
    const waveComponents = [];
    for (let i = 0; i < spec.numWaves; i++) {
        // Distribute frequencies across the range
        const freq = spec.minHz + (spec.maxHz - spec.minHz) * ((i + 1) / (spec.numWaves + 2));
        
        // Calculate amplitude weight based on distance from center frequency
        const distanceFromCenter = Math.abs(freq - spec.centerHz);
        const maxDistance = Math.max(spec.centerHz - spec.minHz, spec.maxHz - spec.centerHz);
        const weight = 1 - (distanceFromCenter / maxDistance) * 0.3; // 70% falloff at edges
        
        // Scale frequency for visualization (quarter second at 256 samples/sec gives us 64 samples)
        const visualFreq = freq / 20; // Scale down for visual appeal
        
        // Use position-based phase offset for consistent, pleasing interference patterns
        const positionRatio = (i + 1) / (spec.numWaves + 2); // 0 to 1 across the range
        const phaseOffset = i + positionRatio * Math.PI * 2; // Spread phases across 2π
        
        waveComponents.push({
            freq: visualFreq,
            amplitude: weight * amplitude,
            phase: phaseOffset // Position-based phase offset
        });
    }
    console.log(waveComponents)

    // Generate raw wave data first
    const rawPoints = [];
    for (let x = 0; x < width; x++) {
        const t = (x / width) * Math.PI * 8; // Time parameter for quarter second
        let y = 0;

        // Sum all frequency components
        waveComponents.forEach(component => {
            y += Math.sin(t * component.freq + component.phase) * component.amplitude;
        });

        rawPoints.push(y);
    }

    // Calculate mean to remove DC bias and ensure centering
    const mean = rawPoints.reduce((sum, val) => sum + val, 0) / rawPoints.length;

    // Apply scaling, centering, and DC bias removal
    for (let x = 0; x < width; x++) {
        let y = centerY - ((rawPoints[x] - mean) * maxAmplitude);

        // Clamp to bounds
        y = Math.max(1, Math.min(height - 1, y));
        points.push(`${x},${y}`);
    }

    return `M${points.join(' L')}`;
}

function updateWaveVisualization(waveId, brainwaveType, amplitude) {
    const wavePath = document.querySelector(`#${waveId} .wave-path`);
    if (!wavePath) return;
    
    const path = generateFrequencyWeightedWave(brainwaveType, amplitude);
    wavePath.setAttribute('d', path);
}

function updateAllWaveVisualizations(brainwaves) {
    // Use relative amplitudes based on the max value for better visual contrast
    let m = Math.max(brainwaves.delta, brainwaves.theta, brainwaves.alpha, brainwaves.beta, brainwaves.gamma);
    m *= (1.0 - 0.0);
    
    // Update each brainwave with realistic frequency patterns
    updateWaveVisualization('deltaWave', 'delta', 0.0 + brainwaves.delta / m);
    updateWaveVisualization('thetaWave', 'theta', 0.0 + brainwaves.theta / m);
    updateWaveVisualization('alphaWave', 'alpha', 0.0 + brainwaves.alpha / m);
    updateWaveVisualization('betaWave',  'beta',  0.0 + brainwaves.beta  / m);
    updateWaveVisualization('gammaWave', 'gamma', 0.0 + brainwaves.gamma / m);
}

function encodeId(headband, run) {
    // Apply reversible transformations to obfuscate the values
    // XOR headband with a secret, then add offset
    const obfuscatedHeadband = (headband ^ 0xB) + 37; // XOR with 11, add 37
    // XOR run with a different secret, multiply, then add offset
    const obfuscatedRun = ((run ^ 0x2A) * 17) + 531; // XOR with 42, multiply by 17, add 531

    // Create string and base64 encode it, then remove padding
    const idString = `${obfuscatedHeadband}x${obfuscatedRun}`;
    return btoa(idString).replace(/=+$/, '');
}

function encodeRandomFortuneTimestamp(timestamp) {
    // Encode timestamp directly (no obfuscation needed)
    // Use 'f' prefix to indicate fortune mode
    const idString = `f${timestamp}`;
    return btoa(idString).replace(/=+$/, '');
}

function decodeId(encodedId) {
    try {
        // Add back padding if needed for proper base64 decoding
        const padding = '='.repeat((4 - (encodedId.length % 4)) % 4);
        const decoded = atob(encodedId + padding);

        // Check for fortune mode (starts with 'f')
        const fortuneMatch = decoded.match(/^f(\d+)$/);
        if (fortuneMatch) {
            const timestamp = parseInt(fortuneMatch[1]);
            return {
                mode: 'fortune',
                timestamp: timestamp
            };
        }

        // Parse "{num}x{num}" format for normal mode
        const match = decoded.match(/^(\d+)x(-?\d+)$/);
        if (match) {
            const obfuscatedHeadband = parseInt(match[1]);
            const obfuscatedRun = parseInt(match[2]);

            // Reverse the transformations
            const headband = ((obfuscatedHeadband - 37) ^ 0xB);
            const run = ((obfuscatedRun - 531) / 17) ^ 0x2A;

            return {
                mode: 'data',
                headband: headband,
                run: run
            };
        }
    } catch (e) {
        console.error('Failed to decode id:', e);
    }
    return null;
}

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);

    // Check for encoded id first
    const id = params.get('id');
    if (id) {
        const decoded = decodeId(id);
        if (decoded) {
            return decoded;
        }
    }

    // Fall back to old format for backwards compatibility
    const run = params.get('r') || params.get('run');
    const headband = params.get('h') || params.get('headband');

    return {
        mode: 'data',
        run: run !== null ? parseInt(run) : null,
        headband: headband !== null ? parseInt(headband) : null
    };
}

function updateUrlParams(headband, run) {
    const url = new URL(window.location);
    // Clear all existing params and set encoded id
    url.search = '';
    url.searchParams.set('id', encodeId(headband, run));
    window.history.replaceState({}, '', url);
}

function updateUrlParamsForRandomFortune(timestamp) {
    const url = new URL(window.location);
    // Clear all existing params and set encoded fortune timestamp
    url.search = '';
    url.searchParams.set('id', encodeRandomFortuneTimestamp(timestamp));
    window.history.replaceState({}, '', url);
}

function getAllFortunes() {
    // Flatten all fortune arrays into one big array
    const allFortunes = [];
    for (const category in fortunes) {
        allFortunes.push(...fortunes[category]);
    }
    return allFortunes;
}

function getRandomFortuneFromTimestamp(timestamp) {
    const allFortunes = getAllFortunes();
    return allFortunes[timestamp % allFortunes.length];
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimestampRange(startTimestamp, numDataPoints, headband) {
    // Each data point is 2 seconds apart
    const intervalMs = 2000; // 2 seconds in milliseconds
    const durationMs = (numDataPoints - 1) * intervalMs;

    const startDate = new Date(startTimestamp);

    const options = {
        hour: '2-digit',
        minute: '2-digit'
    };

    const headbandText = headband !== undefined ? `Headband ${headband} ` : '';

    // Calculate duration in minutes
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = Math.floor((durationMs % 60000) / 1000);
    const durationText = durationSeconds > 0 ? `${durationMinutes}m ${durationSeconds}s` : `${durationMinutes}m`;

    const dateStr = startDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const startTime = startDate.toLocaleString('en-US', options);

    return `from ${headbandText}on ${dateStr} at ${startTime} (${durationText})`;
}

function displayRandomFortune(timestamp) {
    // Get the fortune for this timestamp
    const fortune = getRandomFortuneFromTimestamp(timestamp);

    // Display just the fortune message
    document.getElementById('fortuneMessage').textContent = fortune;

    // Update subtitle to say "randomly" instead of "from brainwave data"
    const fortuneSubtitle = document.querySelector('.fortune-subtitle');
    if (fortuneSubtitle) {
        fortuneSubtitle.textContent = 'Personalized fortune message generated randomly';
    }

    // Show the example link
    const exampleLink = document.querySelector('.example-link');
    if (exampleLink) {
        exampleLink.style.display = 'inline-block';
    }

    // Hide data sections (with safety checks)
    for (const section of document.querySelectorAll('.brainwave-section')) {
        section.style.display = 'none';
    }
    for (const section of document.querySelectorAll('.graph-section')) {
        section.style.display = 'none';
    }

    // Display timestamp in footer with prefix
    document.getElementById('timestamp').textContent = 'Fortune generated on ' + formatTimestamp(timestamp);

    // Hide loading dots and show panel
    document.getElementById('loadingDots').style.display = 'none';
    const dataPanel = document.getElementById('dataPanel');
    dataPanel.style.opacity = '1';
    dataPanel.style.transform = 'scale(1)';
}

function normalizeBrainwaves(rawValues) {
    let { alpha, beta, gamma, delta, theta } = rawValues;
    const total = alpha + beta + gamma + delta + theta;

    if (total === 0) return rawValues;

    return {
        alpha: alpha / total,
        beta: beta / total,
        gamma: gamma / total,
        delta: delta / total,
        theta: theta / total
    };
}

// Chart.js instance and tooltip state
let brainwaveChart = null;
let activenessChart = null;
let lastTooltipIndex = null;

// Helper function to create time labels
function createTimeLabels(numPoints) {
    const totalSeconds = (numPoints - 1) * 2;
    const showMinutes = totalSeconds >= 60;

    return Array.from({ length: numPoints }, (_, i) => {
        const seconds = i * 2;
        if (showMinutes) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${seconds}s`;
        }
    });
}

// Helper function to create common chart options
function createChartOptions(aspectRatio, legendConfig, tooltipConfig, scalesConfig) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: aspectRatio,
        interaction: {
            mode: 'index',
            axis: 'x',
            intersect: false,
        },
        onHover: (event, activeElements) => {
            event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
        },
        plugins: {
            legend: legendConfig,
            tooltip: tooltipConfig
        },
        scales: scalesConfig
    };
}

// Helper function to get gradient color based on value (0-1)
function getGradientColor(value) {
    // Define three key points: 0 (purple/pink), 0.5 (blue), 1 (white)
    const points = [
        { value: 0.0, lightness: 0.6, chroma: 0.18, hue: 300 },  // lighter purple/pink
        { value: 0.5, lightness: 0.5, chroma: 0.15, hue: 250 }, // blue
        { value: 1.0, lightness: 1.0, chroma: 0.06, hue: 250 }  // white
    ];

    // Find the two points to interpolate between
    let p1, p2, t;
    if (value <= 0.5) {
        p1 = points[0];
        p2 = points[1];
        t = value / 0.5; // 0 to 1 in first half
    } else {
        p1 = points[1];
        p2 = points[2];
        t = (value - 0.5) / 0.5; // 0 to 1 in second half
    }

    // Interpolate between the two points
    const lightness = p1.lightness + (p2.lightness - p1.lightness) * t;
    const chroma = p1.chroma + (p2.chroma - p1.chroma) * t;
    const hue = p1.hue + (p2.hue - p1.hue) * t;

    return `oklch(${lightness} ${chroma} ${hue})`;
}

// Helper function to get or create tooltip element
function getOrCreateTooltip(id) {
    let tooltipEl = document.getElementById(id);

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = id;
        tooltipEl.style.opacity = 0;
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.transition = 'opacity 0.15s ease, left 0.2s ease-out, top 0.2s ease-out';
        tooltipEl.style.zIndex = '10000';
        document.body.appendChild(tooltipEl);
    }

    return tooltipEl;
}

// Helper function to create simple tooltip (single value)
function createSimpleTooltip(tooltipEl, tooltipModel, dataFormatter) {
    if (!tooltipEl.querySelector('.tooltip-container')) {
        let innerHtml = '<div class="tooltip-container" style="padding: 12px 16px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); font-family: cmu, Inter, sans-serif; min-width: 130px;">';
        innerHtml += '<div class="tooltip-body" style="position: relative;"></div>';
        innerHtml += '</div>';
        tooltipEl.innerHTML = innerHtml;
    }

    const bodyEl = tooltipEl.querySelector('.tooltip-body');
    if (bodyEl && tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
        const data = dataFormatter(tooltipModel.dataPoints[0]);

        let itemEl = bodyEl.querySelector(`[data-label="${data.label}"]`);
        if (!itemEl) {
            itemEl = document.createElement('div');
            itemEl.setAttribute('data-label', data.label);
            itemEl.style.cssText = 'display: flex; align-items: center; gap: 8px; white-space: nowrap;';
            itemEl.innerHTML = '<span style="width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; background: ' + data.color + ';"></span>' +
                              '<span class="value-text" style="font-size: 12px; font-weight: 500; color: rgba(255, 255, 255, 0.85);">' + data.label + ': ' + data.value + '</span>';
            bodyEl.appendChild(itemEl);
        } else {
            const dot = itemEl.querySelector('span:first-child');
            const valueText = itemEl.querySelector('.value-text');
            if (dot) dot.style.background = data.color;
            if (valueText) valueText.textContent = data.label + ': ' + data.value;
        }
    }
}

// Helper function to position tooltip
function positionTooltip(tooltipEl, context) {
    const tooltipModel = context.tooltip;
    const position = context.chart.canvas.getBoundingClientRect();
    const chartWidth = position.width;
    const tooltipWidth = tooltipEl.offsetWidth || 200;

    const isLeftHalf = tooltipModel.caretX < chartWidth / 2;
    const offsetX = isLeftHalf ? 15 : -tooltipWidth - 15;

    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX + offsetX + 'px';
    tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - 40 + 'px';
}

function createActivenessChart(activenessArray) {
    const ctx = document.getElementById('activenessChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (activenessChart) {
        activenessChart.destroy();
    }

    const numPoints = activenessArray.length;
    const labels = createTimeLabels(numPoints);

    activenessChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Activeness',
                data: activenessArray,
                segment: {
                    borderColor: (context) => {
                        // Get the canvas coordinates for this segment
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;

                        if (!chartArea) {
                            return getGradientColor(0.5);
                        }

                        // Create gradient based on y-values of the two points
                        const y0 = context.p0.parsed.y;
                        const y1 = context.p1.parsed.y;
                        const avgValue = (y0 + y1) / 2;

                        return getGradientColor(avgValue);
                    }
                },
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: (context) => {
                    return getGradientColor(activenessArray[context.dataIndex]);
                },
                pointHoverBorderColor: (context) => {
                    return getGradientColor(activenessArray[context.dataIndex]);
                },
                pointHoverBorderWidth: 2,
                pointHitRadius: 30,
                pointStyle: 'circle'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                axis: 'x',
                intersect: false,
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: function(context) {
                        // Get or create tooltip element
                        const tooltipEl = getOrCreateTooltip('activeness-tooltip');
                        const tooltipModel = context.tooltip;

                        // Hide if no tooltip
                        if (tooltipModel.opacity === 0) {
                            tooltipEl.style.opacity = 0;
                            return;
                        }

                        // Create tooltip content with activeness value
                        createSimpleTooltip(tooltipEl, tooltipModel, (dataPoint) => {
                            const value = dataPoint.parsed.y;
                            let label = 'Activeness';
                            return {
                                label: label,
                                value: (value * 100).toFixed(0) + '%',
                                color: getGradientColor(value)
                            };
                        });

                        // Position tooltip
                        positionTooltip(tooltipEl, context);
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false,
                        drawTicks: false
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 1,
                    display: false,
                    grid: {
                        display: false
                    }
                }
            },
            clip: false
        }
    });
}

function createBrainwaveChart(dataArrays) {
    const ctx = document.getElementById('brainwaveChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (brainwaveChart) {
        brainwaveChart.destroy();
    }

    // Normalize the data at each timestep
    const numPoints = dataArrays.alpha.length;
    const normalizedData = {
        delta: [],
        theta: [],
        alpha: [],
        beta: [],
        gamma: []
    };

    for (let i = 0; i < numPoints; i++) {
        // Apply delta scaling first (same as normalizeBrainwaves function)
        const sum = 1.0; // dataArrays.alpha[i] + dataArrays.beta[i] + dataArrays.gamma[i] + dataArrays.delta[i] + dataArrays.theta[i];

        if (sum > 0) {
            normalizedData.alpha.push(Math.log(dataArrays.alpha[i]) / sum);
            normalizedData.beta.push(Math.log(dataArrays.beta[i]) / sum);
            normalizedData.gamma.push(Math.log(dataArrays.gamma[i]) / sum);
            normalizedData.delta.push(Math.log(dataArrays.delta[i]) / sum);
            normalizedData.theta.push(Math.log(dataArrays.theta[i]) / sum);
        } else {
            normalizedData.alpha.push(0);
            normalizedData.beta.push(0);
            normalizedData.gamma.push(0);
            normalizedData.delta.push(0);
            normalizedData.theta.push(0);
        }
    }

    // Create time labels based on number of data points (2 seconds apart)
    const totalSeconds = (numPoints - 1) * 2;
    const showMinutes = totalSeconds >= 60; // Show minutes if total time is 1 minute or more

    const labels = Array.from({ length: numPoints }, (_, i) => {
        const seconds = i * 2;
        if (showMinutes) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${seconds}s`;
        }
    });

    // Define colors matching the existing CSS classes
    const colors = {
        delta: 'oklch(0.75 0.2 30)',     // red
        theta: 'oklch(0.75 0.2 60)',     // orange
        alpha: 'oklch(0.75 0.2 100)',    // yellow
        beta: 'oklch(0.75 0.2 200)',     // cyan
        gamma: 'oklch(0.75 0.2 250)'     // blue
    };

    brainwaveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Delta',
                    data: normalizedData.delta,
                    borderColor: colors.delta,
                    backgroundColor: colors.delta,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: colors.delta,
                    pointHoverBorderColor: colors.delta,
                    pointHoverBorderWidth: 2,
                    pointHitRadius: 30,
                    pointStyle: 'circle'
                },
                {
                    label: 'Theta',
                    data: normalizedData.theta,
                    borderColor: colors.theta,
                    backgroundColor: colors.theta,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: colors.theta,
                    pointHoverBorderColor: colors.theta,
                    pointHoverBorderWidth: 2,
                    pointHitRadius: 30,
                    pointStyle: 'circle'
                },
                {
                    label: 'Alpha',
                    data: normalizedData.alpha,
                    borderColor: colors.alpha,
                    backgroundColor: colors.alpha,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: colors.alpha,
                    pointHoverBorderColor: colors.alpha,
                    pointHoverBorderWidth: 2,
                    pointHitRadius: 30,
                    pointStyle: 'circle'
                },
                {
                    label: 'Beta',
                    data: normalizedData.beta,
                    borderColor: colors.beta,
                    backgroundColor: colors.beta,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: colors.beta,
                    pointHoverBorderColor: colors.beta,
                    pointHoverBorderWidth: 2,
                    pointHitRadius: 30,
                    pointStyle: 'circle'
                },
                {
                    label: 'Gamma',
                    data: normalizedData.gamma,
                    borderColor: colors.gamma,
                    backgroundColor: colors.gamma,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: colors.gamma,
                    pointHoverBorderColor: colors.gamma,
                    pointHoverBorderWidth: 2,
                    pointHitRadius: 30,
                    pointStyle: 'circle'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            clip: false,
            interaction: {
                mode: 'index',
                axis: 'x',
                intersect: false,
            },
            onHover: (event, activeElements, chart) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        padding: 15,
                        font: {
                            size: 12,
                            family: 'cmu, Inter, sans-serif'
                        },
                        usePointStyle: true,
                        pointStyle: 'line'
                    },
                    onClick: function(e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;

                        // Check if the clicked dataset is currently highlighted (borderWidth = 3)
                        const clickedDataset = chart.data.datasets[index];
                        const isHighlighted = clickedDataset.borderWidth === 3;

                        if (isHighlighted) {
                            // Reset all to normal state
                            chart.data.datasets.forEach((dataset) => {
                                const colors = {
                                    delta: 'oklch(0.75 0.2 30)',
                                    theta: 'oklch(0.75 0.2 60)',
                                    alpha: 'oklch(0.75 0.2 100)',
                                    beta: 'oklch(0.75 0.2 200)',
                                    gamma: 'oklch(0.75 0.2 250)'
                                };
                                const label = dataset.label.toLowerCase();
                                dataset.borderColor = colors[label];
                                dataset.backgroundColor = colors[label];
                                dataset.borderWidth = 2;
                            });
                        } else {
                            // Highlight this one, make others very translucent
                            chart.data.datasets.forEach((dataset, i) => {
                                if (i === index) {
                                    dataset.borderWidth = 3;
                                    // Keep original color
                                    const colors = {
                                        delta: 'oklch(0.75 0.2 30)',
                                        theta: 'oklch(0.75 0.2 60)',
                                        alpha: 'oklch(0.75 0.2 100)',
                                        beta: 'oklch(0.75 0.2 200)',
                                        gamma: 'oklch(0.75 0.2 250)'
                                    };
                                    const label = dataset.label.toLowerCase();
                                    dataset.borderColor = colors[label];
                                    dataset.backgroundColor = colors[label];
                                } else {
                                    dataset.borderWidth = 1;
                                    // Make very translucent
                                    const colors = {
                                        delta: 'oklch(0.75 0.2 30 / 0.5)',
                                        theta: 'oklch(0.75 0.2 60 / 0.5)',
                                        alpha: 'oklch(0.75 0.2 100 / 0.5)',
                                        beta: 'oklch(0.75 0.2 200 / 0.5)',
                                        gamma: 'oklch(0.75 0.2 250 / 0.5)'
                                    };
                                    const label = dataset.label.toLowerCase();
                                    dataset.borderColor = colors[label];
                                    dataset.backgroundColor = colors[label];
                                }
                            });
                        }

                        chart.update();
                    }
                },
                tooltip: {
                    enabled: false,
                    external: function(context) {
                        // Get or create tooltip element
                        let tooltipEl = document.getElementById('chartjs-tooltip');

                        if (!tooltipEl) {
                            tooltipEl = document.createElement('div');
                            tooltipEl.id = 'chartjs-tooltip';
                            tooltipEl.style.opacity = 0;
                            tooltipEl.style.position = 'absolute';
                            tooltipEl.style.pointerEvents = 'none';
                            tooltipEl.style.transition = 'opacity 0.15s ease, left 0.2s ease-out, top 0.2s ease-out';
                            document.body.appendChild(tooltipEl);
                        }

                        // Hide if no tooltip
                        const tooltipModel = context.tooltip;
                        if (tooltipModel.opacity === 0) {
                            tooltipEl.style.opacity = 0;
                            return;
                        }

                        // Build tooltip content
                        if (tooltipModel.body) {
                            const titleLines = tooltipModel.title || [];

                            // Create array of data points with their info and sort by value (descending)
                            const dataPointsWithInfo = tooltipModel.dataPoints.map((dataPoint, i) => ({
                                colors: tooltipModel.labelColors[i],
                                value: dataPoint.parsed.y,
                                label: dataPoint.dataset.label
                            }));

                            // Sort by value descending
                            dataPointsWithInfo.sort((a, b) => b.value - a.value);

                            // Check if tooltip structure exists, if not create it
                            if (!tooltipEl.querySelector('.tooltip-container')) {
                                let innerHtml = '<div class="tooltip-container" style="padding: 12px 16px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 12px; backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); font-family: cmu, Inter, sans-serif; min-width: 130px;">';

                                // Body container (no title)
                                innerHtml += '<div class="tooltip-body" style="position: relative;"></div>';
                                innerHtml += '</div>';
                                tooltipEl.innerHTML = innerHtml;
                            }

                            // Update body with animated reordering
                            const bodyEl = tooltipEl.querySelector('.tooltip-body');
                            if (bodyEl) {
                                let sum = 0;
                                dataPointsWithInfo.forEach((item) => { sum += Math.exp(item.value); });
                                // Get existing items or create new ones
                                dataPointsWithInfo.forEach((item, index) => {
                                    let itemEl = bodyEl.querySelector(`[data-label="${item.label}"]`);

                                    if (!itemEl) {
                                        // Create new item
                                        itemEl = document.createElement('div');
                                        itemEl.setAttribute('data-label', item.label);
                                        itemEl.style.cssText = 'display: flex; align-items: center; gap: 8px; position: absolute; left: 0; width: 100%; height: 22px; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease; white-space: nowrap;';

                                        const valuePercent = (Math.exp(item.value) / sum * 100).toFixed(1);
                                        itemEl.innerHTML = '<span style="width: 10px; height: 10px; flex-shrink: 0; border-radius: 50%; background: ' + item.colors.backgroundColor + ';"></span>' +
                                                          '<span class="value-text" style="font-size: 12px; font-weight: 500; color: rgba(255, 255, 255, 0.85);">' + item.label + ': ' + valuePercent + '%</span>';
                                        bodyEl.appendChild(itemEl);
                                    } else {
                                        // Update value
                                        const valuePercent = (Math.exp(item.value) / sum * 100).toFixed(1);
                                        const valueText = itemEl.querySelector('.value-text');
                                        if (valueText) {
                                            valueText.textContent = item.label + ': ' + valuePercent + '%';
                                        }
                                    }

                                    // Animate to new position
                                    const targetY = index * 21;
                                    itemEl.style.transform = `translateY(${targetY}px)`;
                                    itemEl.style.opacity = '1';
                                });

                                // Set container height based on number of items
                                bodyEl.style.height = (dataPointsWithInfo.length * 21) + 'px';
                            }
                        }

                        // Position tooltip intelligently
                        const position = context.chart.canvas.getBoundingClientRect();
                        const chartWidth = position.width;
                        const tooltipWidth = tooltipEl.offsetWidth || 200; // Fallback width

                        // Determine if tooltip should be on left or right of the data point
                        const isLeftHalf = tooltipModel.caretX < chartWidth / 2;
                        const offsetX = isLeftHalf ? 15 : -tooltipWidth - 15; // 15px padding from cursor

                        tooltipEl.style.opacity = 1;
                        tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX + offsetX + 'px';
                        tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - 80 + 'px'; // Offset up slightly
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false,
                        drawTicks: false
                    },
                    ticks: {
                        maxTicksLimit: 10,
                        display: false
                    }
                },
                y: {
                    display: false,
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function removeRepeatedTail(dataArrays) {
    // Remove synchronized repeated values from the end of all data arrays
    // Only remove a value from all arrays if ALL arrays have the same value as their previous entry

    if (!dataArrays || Object.keys(dataArrays).length === 0) return dataArrays;

    // Get all array keys and ensure they're all arrays
    const keys = Object.keys(dataArrays);
    if (keys.length === 0) return dataArrays;

    // Check that all values are arrays and get the minimum length
    let minLength = Infinity;
    for (const key of keys) {
        if (!Array.isArray(dataArrays[key])) return dataArrays;
        minLength = Math.min(minLength, dataArrays[key].length);
    }

    if (minLength <= 1) return dataArrays; // Need at least 2 values to compare

    // Start from the end and work backwards
    let removeCount = 0;
    for (let i = minLength - 1; i > 0; i--) {
        // Check if ALL arrays have the same value as their previous entry at this position
        let allRepeated = true;
        for (const key of keys) {
            if (dataArrays[key][i] !== dataArrays[key][i - 1]) {
                allRepeated = false;
                break;
            }
        }

        if (allRepeated) {
            removeCount++;
        } else {
            // Stop as soon as we find a position where not all values repeat
            break;
        }
    }

    // Remove the tail from all arrays
    if (removeCount > 0) {
        const result = {};
        for (const key of keys) {
            result[key] = dataArrays[key].slice(0, -removeCount);
        }
        console.log(`Removed ${removeCount} synchronized repeated values from tail`);
        return result;
    }

    return dataArrays;
}

function calculateAverage(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
}

const fortunes = {
    // Alpha fortunes
    alpha_active: [
        "Your relaxed focus brings sharp clarity to every task. Productive calm is your superpower.",
        "Alert yet at peace, you navigate complexity with effortless precision.",
        "Calm engagement unlocks creative problem-solving. Trust this balanced energy.",
        "Gentle attention achieves what force cannot. Your steady presence opens all doors.",
        "The art of relaxed concentration transforms ordinary moments into opportunities.",
        "Peaceful awareness meets purposeful action. You master the balance few achieve."
    ],
    alpha_clear: [
        "Your relaxed mind opens to creative possibilities. Trust the calm clarity within.",
        "In stillness, solutions emerge naturally. Let your awareness guide you.",
        "Creative energy flows when the mind is at peace. Embrace this moment.",
        "Tranquil waters reflect the sky perfectly. Your calm mind mirrors wisdom.",
        "Serenity becomes the canvas upon which inspiration paints its masterpiece.",
        "Rest is not idleness—it is the space where your greatest ideas take form."
    ],
    alpha_meditation: [
        "Deep relaxation meets inner knowing. Your peaceful mind touches profound wisdom.",
        "In meditative flow, creativity and tranquility become one.",
        "Serene awareness opens doorways to your most authentic insights.",
        "The silence between thoughts holds secrets the noise never reveals.",
        "In profound rest, your soul remembers what your mind forgot.",
        "Peace deepens into revelation. You float in the ocean of consciousness itself."
    ],
    alpha_generic: [
        "Calm creativity flows through your consciousness.",
        "Your relaxed awareness moves with natural grace.",
        "Peace and possibility dance together in your mind.",
        "Gentle knowing guides you through the day. Trust the quiet voice.",
        "Your inner stillness radiates outward, touching all you encounter.",
        "Relaxation is not weakness—it is the power of water that shapes stone."
    ],

    // Beta fortunes
    beta_active: [
        "Your active mind cuts through complexity with precision and focus.",
        "Problem-solving comes naturally when your awareness is sharp and engaged.",
        "Mental agility leads to breakthrough moments. Stay alert to opportunities.",
        "Lightning-quick perception illuminates what others overlook. Strike while the iron glows.",
        "Your razor-sharp attention carves pathways through impossible terrain.",
        "Dynamic thinking meets determined action. The world bends to your clarity."
    ],
    beta_clear: [
        "Focused clarity brings elegant solutions to complex challenges.",
        "Your alert yet calm mind sees patterns others miss.",
        "Balanced thinking transforms obstacles into stepping stones.",
        "Poised awareness cuts through confusion like a blade through silk.",
        "Steady observation reveals the hidden order within apparent chaos.",
        "Your composed attention finds the thread that unravels every knot."
    ],
    beta_meditation: [
        "Active consciousness meets inner stillness. Rare insight emerges from this union.",
        "Your engaged mind discovers peace within motion—a paradox that reveals truth.",
        "Alert meditation unlocks wisdom hidden in the dance of thought and silence.",
        "The eye of the hurricane: perfect calm surrounded by dynamic force.",
        "Moving meditation reveals truths that sitting never could. Walk the razor's edge.",
        "Stillness within action—the warrior's secret, the sage's paradox, your gift today."
    ],
    beta_generic: [
        "Sharp clarity energizes your thinking.",
        "Your active awareness navigates the world with purpose.",
        "Mental energy flows through channels of focused intention.",
        "Quick thinking opens doors before they close. Your timing is impeccable.",
        "Engaged perception transforms the mundane into the meaningful.",
        "Your wakeful mind dances with reality, leading when it must, following when it should."
    ],

    // Gamma fortunes
    gamma_active: [
        "Your heightened mind makes connections others cannot see.",
        "Peak awareness transforms complexity into crystalline understanding.",
        "Hyperconnected consciousness breaks through to revolutionary insight.",
        "Synapses fire in symphonic unity. You perceive the web that connects all things.",
        "Your accelerated awareness collapses time—past, present, future merge into now.",
        "Neural lightning reveals the invisible architecture underlying visible reality."
    ],
    gamma_clear: [
        "Expanded awareness meets serene clarity. Profound patterns reveal themselves.",
        "Your heightened perception sees truth with calm precision.",
        "Peak consciousness flows through open channels of understanding.",
        "The universe whispers its secrets to minds like yours—vast yet focused.",
        "Elevated sight meets tranquil heart. You see infinity without losing yourself.",
        "Crystalline awareness refracts reality into its component truths."
    ],
    gamma_meditation: [
        "Transcendent awareness emerges from the depths. You touch universal knowing.",
        "The rarest state opens—pure consciousness witnessing itself.",
        "In heightened stillness, all boundaries dissolve into infinite awareness.",
        "You stand at the threshold where self dissolves into everything.",
        "Peak experience meets deepest surrender. The cosmos recognizes itself through you.",
        "In this moment, you are both the observer and the observed—unity realized."
    ],
    gamma_generic: [
        "Insight emerges from the synthesis of ideas. Trust your expanded awareness.",
        "The patterns of understanding reveal themselves to your awakened consciousness.",
        "Your heightened mind perceives connections across all dimensions.",
        "Quantum leaps of understanding occur when perception reaches critical velocity.",
        "Your consciousness operates at frequencies most never access. Use this gift wisely.",
        "The veil between seen and unseen grows transparent to your elevated sight."
    ],

    // Delta fortunes
    delta_active: [
        "Deep processing meets outward engagement. Hidden wisdom emerges into action.",
        "Your unconscious mind works while you move—transformation in motion.",
        "Profound change flows beneath active awareness. Trust the deep currents.",
        "Primordial power rises through your actions. Ancient knowing guides modern doing.",
        "The depths animate your surface. You move with unconscious grace.",
        "Root wisdom flows into branch and leaf. Your actions carry primordial truth."
    ],
    delta_clear: [
        "Your unconscious mind processes profound transformations with gentle clarity.",
        "Deep wisdom surfaces into conscious awareness. Trust what rises from below.",
        "The depths speak in whispers that your calm mind can finally hear.",
        "What stirs in the abyss seeks the light. Welcome these visitors from below.",
        "The slow work of the depths finally reaches the surface. Receive these gifts.",
        "Ancient currents become conscious thoughts. The old ways speak in new voices."
    ],
    delta_meditation: [
        "In trance-like depths, your deepest wisdom emerges from shadow into light.",
        "The gateway to archetypal wisdom and healing opens before you.",
        "Your consciousness touches the deepest waters where all things begin.",
        "You descend to the source of all streams. Drink deeply from the first spring.",
        "The cave at the bottom of your being holds treasures beyond price.",
        "In the womb of consciousness, transformation gestates in perfect darkness."
    ],
    delta_generic: [
        "Deep currents of change flow beneath conscious awareness. Allow the process.",
        "Your unconscious mind weaves transformation in the hidden depths.",
        "You journey to places beyond ordinary knowing.",
        "The roots grow strong in darkness. Trust what you cannot yet see.",
        "Invisible work proceeds in the depths. The harvest comes in its season.",
        "What sleeps beneath will wake in time. The depths are never truly still."
    ],

    // Theta fortunes
    theta_active: [
        "Subconscious creativity meets focused action. Innovation flows freely.",
        "Your intuitive mind engages with the world—dreams become reality.",
        "Active imagination transforms vision into tangible form.",
        "The dreaming mind sculpts waking reality. Your visions take physical form.",
        "Inspiration drives your hands today. The muse and the maker are one.",
        "Creative fire burns bright in the forge of action. You birth the impossible."
    ],
    theta_clear: [
        "Your subconscious mind weaves creativity and intuition into new forms.",
        "Meditative clarity reveals the hidden connections between all things.",
        "Insight flows from deep waters into the light of understanding.",
        "The twilight mind sees what daylight obscures. Trust your sideways knowing.",
        "Half-dreaming wisdom clarifies what sharp thinking missed. Let soft focus reveal.",
        "The boundary between imagination and perception blurs—here truth emerges."
    ],
    theta_meditation: [
        "The realm of visions and symbolic truth opens before you.",
        "Your subconscious unfolds like a lotus, revealing layer upon layer of meaning.",
        "In this liminal space, your mind creates bridges between worlds.",
        "You walk between waking and sleeping, knowing and unknowing, form and void.",
        "The dream world and waking world recognize no border today. You are the bridge.",
        "Symbolic language speaks louder than words. Your soul reads the signs."
    ],
    theta_generic: [
        "Subconscious wisdom flows through your awareness.",
        "Your intuitive mind perceives truths beyond logic.",
        "Messages arrive from the realm of dreams.",
        "The twilight realm whispers insights the daylight mind cannot grasp.",
        "Your inner vision sees further than your outer eyes. Trust the images.",
        "Creativity stirs in the half-light of consciousness. Feed it and watch it grow."
    ],

    // Balanced state
    balanced: [
        "All levels of consciousness work in harmony to create perfect understanding.",
        "Your integrated awareness brings balanced perspective to every situation.",
        "Mind, body, and spirit align to manifest your highest potential.",
        "The symphony of your being plays in perfect harmony. Each instrument serves the whole.",
        "Like a master conductor, you orchestrate all aspects of awareness into sublime unity.",
        "In this moment of equilibrium, you access the wisdom of all states at once."
    ]
}

function getActivenessState(activenessArray) {
    // Calculate what proportion of time was spent in each state
    // Active: 1-2/3 (0.67-1.0)
    // Clear: 2/3-1/3 (0.33-0.67)
    // Meditation: 1/3-0 (0.0-0.33)

    if (!activenessArray || activenessArray.length === 0) {
        return null; // No activeness data
    }

    let activeCount = 0;
    let clearCount = 0;
    let meditationCount = 0;

    activenessArray.forEach(value => {
        if (value >= 2/3) {
            activeCount++;
        } else if (value >= 1/3) {
            clearCount++;
        } else {
            meditationCount++;
        }
    });

    const total = activenessArray.length;
    const activeRatio = activeCount / total;
    const clearRatio = clearCount / total;
    const meditationRatio = meditationCount / total;

    // Check if any state dominates (>= 2/3 of the time)
    if (activeRatio >= 2/3) {
        return 'active';
    } else if (clearRatio >= 2/3) {
        return 'clear';
    } else if (meditationRatio >= 2/3) {
        return 'meditation';
    }

    // No dominant state
    return 'generic';
}

function getDominantPattern(brainwaves, mlAnalysis, activenessArray) {
    // Get the activeness state
    const activenessState = getActivenessState(activenessArray);

    // Find dominant brainwave (excluding delta from dominance check, but include in normalization)
    let { alpha, beta, gamma, theta, delta } = brainwaves;

    // Apply frequency-based weighting
    alpha *= Math.pow((8 + 12) / 2, weighting_power);
    beta *= Math.pow((12 + 30) / 2, weighting_power);
    gamma *= Math.pow(30, weighting_power);
    delta *= Math.pow(0.5, weighting_power);
    theta *= Math.pow((4 + 8) / 2, weighting_power);

    const total = alpha + beta + gamma + delta + theta;
    alpha /= total;
    beta  /= total;
    gamma /= total;
    delta /= total;
    theta /= total;

    // Include delta in consideration for dominant wave
    const waves = { alpha, beta, gamma, theta, delta };

    let maxWave = null;
    let maxValue = 0;

    for (const [wave, value] of Object.entries(waves)) {
        if (value > maxValue && value > dominant_cutoff) {
            maxValue = value;
            maxWave = wave;
        }
    }

    // If no dominant wave, return balanced
    if (!maxWave) {
        return 'balanced';
    }

    // If no activeness data, use generic for that brainwave
    if (!activenessState) {
        return `${maxWave}_generic`;
    }

    // Combine brainwave and activeness state
    return `${maxWave}_${activenessState}`;
}

function getRandomFortune(category, brainwaves, mlAnalysis) {
    const categoryFortunes = fortunes[category] || fortunes.balanced;
    
    // Create a deterministic seed based on the brainwave and ML values
    const seed = Math.round(
        (brainwaves.alpha * 1000) + 
        (brainwaves.beta * 2000) + 
        (brainwaves.gamma * 3000) + 
        (brainwaves.delta * 4000) + 
        (brainwaves.theta * 5000) +
        //(mlAnalysis.focus * 6000) +
        //(mlAnalysis.clear * 7000) +
        (mlAnalysis.meditation * 8000) //+
        //(mlAnalysis.dream * 9000)
    );
    
    // Use the seed to pick a deterministic fortune
    const index = seed % categoryFortunes.length;
    return categoryFortunes[index];
}

function detectLongStraightSections(dataArrays) {
    // Check if any brainwave has identical values for more than 30 consecutive points (60 seconds)
    const threshold = 30; // 30 points = 60 seconds (each point is 2 seconds)

    for (const wave in dataArrays) {
        const data = dataArrays[wave];
        if (!Array.isArray(data) || data.length < threshold) continue;

        let consecutiveCount = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === data[i - 1]) {
                consecutiveCount++;
                if (consecutiveCount >= threshold) {
                    return true; // Found a long straight section
                }
            } else {
                consecutiveCount = 1;
            }
        }
    }

    return false;
}

function highlightPeakFrequency(dominantPattern) {
    // Parse the pattern (e.g., "beta_active", "alpha_generic", "balanced")
    const parts = dominantPattern.split('_');
    const brainwaveType = parts[0];

    // Remove peak-frequency class and label from all wave-stats
    document.querySelectorAll('.wave-stat').forEach(stat => {
        stat.classList.remove('peak-frequency');
        const existingLabel = stat.querySelector('.peak-label');
        if (existingLabel) {
            existingLabel.remove();
        }
    });

    // Add peak-frequency class to the dominant brainwave (if not balanced)
    if (brainwaveType !== 'balanced') {
        const waveMap = {
            delta: 'deltaWave',
            theta: 'thetaWave',
            alpha: 'alphaWave',
            beta: 'betaWave',
            gamma: 'gammaWave'
        };

        const waveId = waveMap[brainwaveType];
        if (waveId) {
            const waveStat = document.getElementById(waveId)?.closest('.wave-stat');
            if (waveStat) {
                waveStat.classList.add('peak-frequency');

                // Add the label with bold "Peak frequency"
                const label = document.createElement('div');
                label.className = 'peak-label';
                label.innerHTML = '<strong>Peak frequency</strong>: this type of brainwave frequency was the most prominent in your data';
                waveStat.appendChild(label);
            }
        }
    }
}

function updateBrainwaveDisplay(brainwaves, mlAnalysis, timestamp, numDataPoints, headband, rawDataArrays, activenessArray) {
    // Create the activeness chart if we have activeness data
    if (activenessArray && activenessArray.length > 0) {
        createActivenessChart(activenessArray);
    }

    // Create the brainwave chart if we have arrays of raw data
    if (rawDataArrays) {
        createBrainwaveChart(rawDataArrays);
    }

    // Show/hide graph sections based on data availability
    const graphSections = document.querySelectorAll('.graph-section');
    graphSections.forEach((section, index) => {
        if (index === 0) {
            // First graph section is brainwaves over time
            section.style.display = rawDataArrays ? 'block' : 'none';

            // Show/hide poor connection warning based on straight sections detection
            if (rawDataArrays) {
                const hasLongStraightSections = detectLongStraightSections(rawDataArrays);
                const warningSubtitle = section.querySelector('.warning-subtitle');
                if (warningSubtitle) {
                    warningSubtitle.style.display = hasLongStraightSections ? 'block' : 'none';
                }
            }
        } else if (index === 1) {
            // Second graph section is activeness
            section.style.display = (activenessArray && activenessArray.length > 0) ? 'block' : 'none';

            // Show/hide poor connection warning based on straight sections detection in activeness data
            if (activenessArray && activenessArray.length > 0) {
                const hasLongStraightSections = detectLongStraightSections({ activeness: activenessArray });
                const warningSubtitle = section.querySelector('.warning-subtitle');
                if (warningSubtitle) {
                    warningSubtitle.style.display = hasLongStraightSections ? 'block' : 'none';
                }
            }
        }
    });

    // Apply frequency-based weighting (same as in getDominantPattern)
    let adjustedBrainwaves = {
        alpha: brainwaves.alpha * Math.pow((8 + 12) / 2, weighting_power),
        beta: brainwaves.beta * Math.pow((12 + 30) / 2, weighting_power),
        gamma: brainwaves.gamma * Math.pow(30, weighting_power),
        delta: brainwaves.delta * Math.pow(0.5, weighting_power),
        theta: brainwaves.theta * Math.pow((4 + 8) / 2, weighting_power)
    };

    // Re-normalize to percentages
    const total = adjustedBrainwaves.alpha + adjustedBrainwaves.beta + adjustedBrainwaves.gamma + adjustedBrainwaves.delta + adjustedBrainwaves.theta;
    adjustedBrainwaves.alpha /= total;
    adjustedBrainwaves.beta /= total;
    adjustedBrainwaves.gamma /= total;
    adjustedBrainwaves.delta /= total;
    adjustedBrainwaves.theta /= total;

    // Update brainwave values in number boxes (frequency-weighted normalized percentages)
    document.getElementById('deltaBox').textContent = (adjustedBrainwaves.delta * 100).toFixed(0) + '%';
    document.getElementById('thetaBox').textContent = (adjustedBrainwaves.theta * 100).toFixed(0) + '%';
    document.getElementById('alphaBox').textContent = (adjustedBrainwaves.alpha * 100).toFixed(0) + '%';
    document.getElementById('betaBox').textContent = (adjustedBrainwaves.beta * 100).toFixed(0) + '%';
    document.getElementById('gammaBox').textContent = (adjustedBrainwaves.gamma * 100).toFixed(0) + '%';

    // Update wave visualizations
    updateAllWaveVisualizations(brainwaves);

    // Update fortune based on the data
    const dominantPattern = getDominantPattern(brainwaves, mlAnalysis, activenessArray);
    const fortune = getRandomFortune(dominantPattern, brainwaves, mlAnalysis);
    document.getElementById('fortuneMessage').textContent = fortune;

    // Highlight the peak frequency
    highlightPeakFrequency(dominantPattern);

    // Show data sections (brainwave section only, ML is commented out in HTML)
    const brainwaveSection = document.querySelector('.brainwave-section');
    if (brainwaveSection) {
        brainwaveSection.style.display = 'block';
    }

    // Display timestamp range in footer if provided
    if (timestamp && numDataPoints) {
        document.getElementById('timestamp').textContent = 'Anonymized brainwave data ' + formatTimestampRange(timestamp, numDataPoints, headband);
    } else {
        document.getElementById('timestamp').textContent = '';
    }

    // Hide loading dots and scale in the data panel
    document.getElementById('loadingDots').style.display = 'none';
    const dataPanel = document.getElementById('dataPanel');
    dataPanel.style.opacity = '1';
    dataPanel.style.transform = 'scale(1)';
}

async function fetchBrainwaveData() {
    try {
        const urlParams = getUrlParams();
        console.log('URL Params:', urlParams);

        // Show loading dots
        document.getElementById('loadingDots').style.display = 'block';
        document.getElementById('fortuneMessage').textContent = 'Connecting to the cosmos...';

        // Check if we're in fortune mode
        if (urlParams.mode === 'fortune') {
            // Display the random fortune from the timestamp
            displayRandomFortune(urlParams.timestamp);
            updateUrlParamsForRandomFortune(urlParams.timestamp);
            return;
        }

        // Check if headband is missing or out of range [0, 10] - trigger random fortune mode
        if (urlParams.headband === null || urlParams.headband < 0 || urlParams.headband > 10) {
            // Use current timestamp
            const timestamp = Date.now();
            await new Promise(r => setTimeout(r, 1000));
            displayRandomFortune(timestamp);
            updateUrlParamsForRandomFortune(timestamp);
            console.log('Invalid or missing headband, showing random fortune with timestamp:', timestamp);
            return;
        }

        // Build request body - only include run if it's specified in URL
        const requestBody = { headband: urlParams.headband };
        if (urlParams.run !== null) {
            requestBody.run = urlParams.run;
        }

        const response = await fetch('https://bq3lmawgx4.execute-api.us-east-2.amazonaws.com/query_seventh_dimension_ITP_camp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error('Failed to fetch brainwave data');
        }

        const data = await response.json();
        console.log('Received data:', data);

        if (data.alpha_smoothed) { data.alpha = data.alpha_smoothed; }
        if (data.beta_smoothed) { data.beta = data.beta_smoothed; }
        if (data.gamma_smoothed) { data.gamma = data.gamma_smoothed; }
        if (data.delta_smoothed) { data.delta = data.delta_smoothed; }
        if (data.theta_smoothed) { data.theta = data.theta_smoothed; }

        // Extract run number from response metadata (if available) or from data structure
        // The query returns the actual run number used in the response
        const actualRun = data.run || urlParams.run || 1;

        // Update URL params with the actual run number used
        updateUrlParams(urlParams.headband, actualRun);

        // Store raw data arrays for the chart
        let rawDataArrays = {
            alpha: Array.isArray(data.alpha) ? data.alpha : [data.alpha || 0],
            beta: Array.isArray(data.beta) ? data.beta : [data.beta || 0],
            gamma: Array.isArray(data.gamma) ? data.gamma : [data.gamma || 0],
            delta: Array.isArray(data.delta) ? data.delta : [data.delta || 0],
            theta: Array.isArray(data.theta) ? data.theta : [data.theta || 0]
        };

        // Extract activeness data if available (before tail removal)
        let activenessArray = Array.isArray(data.activeness) ? data.activeness : (data.activeness !== undefined ? [data.activeness] : []);

        // Remove synchronized repeated values from the tail (based on brainwave data only)
        const originalLength = rawDataArrays.alpha.length;
        rawDataArrays = removeRepeatedTail(rawDataArrays);
        const newLength = rawDataArrays.alpha.length;
        const removeCount = originalLength - newLength;

        // Remove the same number of entries from activeness array
        if (activenessArray.length > 0 && removeCount > 0) {
            activenessArray = activenessArray.slice(0, -removeCount);
        }

        // Calculate averages of all values for display
        const rawBrainwaves = {
            alpha: calculateAverage(rawDataArrays.alpha),
            beta: calculateAverage(rawDataArrays.beta),
            gamma: calculateAverage(rawDataArrays.gamma),
            delta: calculateAverage(rawDataArrays.delta),
            theta: calculateAverage(rawDataArrays.theta)
        };
        const brainwaves = normalizeBrainwaves(rawBrainwaves);

        // Extract ML analysis - calculate averages (also clean these arrays)
        let mlDataArrays = {
            focus: Array.isArray(data.focus) ? data.focus : [data.focus || 0],
            clear: Array.isArray(data.clear) ? data.clear : [data.clear || 0],
            meditation: Array.isArray(data.meditation) ? data.meditation : [data.meditation || 0],
            dream: Array.isArray(data.dream) ? data.dream : [data.dream || 0]
        };
        mlDataArrays = removeRepeatedTail(mlDataArrays);

        const mlAnalysis = {
            focus: calculateAverage(mlDataArrays.focus),
            clear: calculateAverage(mlDataArrays.clear),
            meditation: calculateAverage(mlDataArrays.meditation),
            dream: calculateAverage(mlDataArrays.dream)
        };

        // Extract timestamp if available and convert to milliseconds
        const timestamp = data.start_timestamp ? new Date(data.start_timestamp).getTime() : null;

        // Determine number of data points from one of the arrays (they should all have the same length)
        const numDataPoints = rawDataArrays.alpha.length;

        // Update the display with raw data arrays for charting
        updateBrainwaveDisplay(brainwaves, mlAnalysis, timestamp, numDataPoints, urlParams.headband, rawDataArrays, activenessArray);

        console.log('Brainwave data updated:', { brainwaves, mlAnalysis, run: actualRun, timestamp, numDataPoints, activenessCount: activenessArray.length });

    } catch (error) {
        console.error('Error fetching brainwave data:', error);
        // Show error in display
        const errorMsg = 'X';
        document.getElementById('deltaBox').textContent = errorMsg;
        document.getElementById('thetaBox').textContent = errorMsg;
        document.getElementById('alphaBox').textContent = errorMsg;
        document.getElementById('betaBox').textContent = errorMsg;
        document.getElementById('gammaBox').textContent = errorMsg;
        document.getElementById('focusBox').textContent = errorMsg;
        document.getElementById('clearBox').textContent = errorMsg;
        document.getElementById('meditationBox').textContent = errorMsg;
        document.getElementById('dreamBox').textContent = errorMsg;
        document.getElementById('fortuneMessage').textContent = 'Unable to read brainwaves. The universe is cloudy today.';

        // Hide loading dots and still scale in the panel even on error
        document.getElementById('loadingDots').style.display = 'none';
        const dataPanel = document.getElementById('dataPanel');
        dataPanel.style.opacity = '1';
        dataPanel.style.transform = 'scale(1)';
    }
}

// Add click handler to hide tooltips when clicking outside charts
document.addEventListener('click', (event) => {
    const isChartClick = event.target.closest('canvas');
    if (!isChartClick) {
        // Hide all tooltips
        const tooltips = ['chartjs-tooltip', 'activeness-tooltip'];
        tooltips.forEach(id => {
            const tooltip = document.getElementById(id);
            if (tooltip) {
                tooltip.style.opacity = 0;
            }
        });
    }
});

// Initialize when page loads
window.addEventListener('load', fetchBrainwaveData);