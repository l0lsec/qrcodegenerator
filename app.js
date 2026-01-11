/**
 * QR Forge — Local QR Code Generator
 * All generation happens client-side. No data leaves your device.
 * Uses QRious library for client-side QR code generation
 */

(function() {
    'use strict';

    // DOM Elements
    const elements = {
        // Tabs
        tabs: document.querySelectorAll('.tab-btn'),
        fieldGroups: document.querySelectorAll('.field-group'),
        
        // Text/URL inputs
        textInput: document.getElementById('text-input'),
        urlInput: document.getElementById('url-input'),
        charCount: document.getElementById('char-count'),
        
        // WiFi inputs
        wifiSsid: document.getElementById('wifi-ssid'),
        wifiPassword: document.getElementById('wifi-password'),
        wifiEncryption: document.getElementById('wifi-encryption'),
        wifiHidden: document.getElementById('wifi-hidden'),
        togglePassword: document.querySelector('.toggle-password'),
        
        // Email inputs
        emailAddress: document.getElementById('email-address'),
        emailSubject: document.getElementById('email-subject'),
        emailBody: document.getElementById('email-body'),
        
        // Customization
        qrSize: document.getElementById('qr-size'),
        sizeValue: document.getElementById('size-value'),
        errorCorrection: document.getElementById('error-correction'),
        fgColor: document.getElementById('fg-color'),
        bgColor: document.getElementById('bg-color'),
        fgColorText: document.getElementById('fg-color-text'),
        bgColorText: document.getElementById('bg-color-text'),
        presetSwatches: document.querySelectorAll('.swatch'),
        
        // Output
        qrPlaceholder: document.getElementById('qr-placeholder'),
        qrContainer: document.getElementById('qr-container'),
        
        // Actions
        downloadPng: document.getElementById('download-png'),
        downloadSvg: document.getElementById('download-svg'),
        copyClipboard: document.getElementById('copy-clipboard'),
        
        // Toast
        toast: document.getElementById('toast')
    };

    // Current state
    let currentType = 'text';
    let currentQr = null;
    let debounceTimer = null;

    // Initialize
    function init() {
        setupTabs();
        setupInputListeners();
        setupCustomizationListeners();
        setupPasswordToggle();
        setupPresetSwatches();
        setupActionButtons();
        
        // Focus on the main input
        elements.textInput.focus();
    }

    // Tab switching
    function setupTabs() {
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const type = tab.dataset.type;
                
                // Update active tab
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active field group
                elements.fieldGroups.forEach(group => {
                    group.classList.remove('active');
                    if (group.dataset.field === type) {
                        group.classList.add('active');
                    }
                });
                
                currentType = type;
                generateQR();
            });
        });
    }

    // Input listeners with debounce
    function setupInputListeners() {
        const inputs = [
            elements.textInput,
            elements.urlInput,
            elements.wifiSsid,
            elements.wifiPassword,
            elements.wifiEncryption,
            elements.wifiHidden,
            elements.emailAddress,
            elements.emailSubject,
            elements.emailBody
        ];

        inputs.forEach(input => {
            if (input) {
                const eventType = input.type === 'checkbox' ? 'change' : 'input';
                input.addEventListener(eventType, debounce(generateQR, 300));
            }
        });

        // Character count for text input
        elements.textInput.addEventListener('input', () => {
            elements.charCount.textContent = elements.textInput.value.length;
        });
    }

    // Customization listeners
    function setupCustomizationListeners() {
        // Size slider
        elements.qrSize.addEventListener('input', () => {
            elements.sizeValue.textContent = elements.qrSize.value;
            generateQR();
        });

        // Error correction
        elements.errorCorrection.addEventListener('change', generateQR);

        // Color pickers
        elements.fgColor.addEventListener('input', () => {
            elements.fgColorText.value = elements.fgColor.value;
            generateQR();
        });

        elements.bgColor.addEventListener('input', () => {
            elements.bgColorText.value = elements.bgColor.value;
            generateQR();
        });

        // Color text inputs
        elements.fgColorText.addEventListener('input', () => {
            if (isValidHex(elements.fgColorText.value)) {
                elements.fgColor.value = elements.fgColorText.value;
                generateQR();
            }
        });

        elements.bgColorText.addEventListener('input', () => {
            if (isValidHex(elements.bgColorText.value)) {
                elements.bgColor.value = elements.bgColorText.value;
                generateQR();
            }
        });
    }

    // Password visibility toggle
    function setupPasswordToggle() {
        elements.togglePassword.addEventListener('click', () => {
            const input = elements.wifiPassword;
            const eyeOpen = elements.togglePassword.querySelector('.eye-open');
            const eyeClosed = elements.togglePassword.querySelector('.eye-closed');
            
            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
            } else {
                input.type = 'password';
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            }
        });
    }

    // Preset color swatches
    function setupPresetSwatches() {
        elements.presetSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                const fg = swatch.dataset.fg;
                const bg = swatch.dataset.bg;
                
                elements.fgColor.value = fg;
                elements.bgColor.value = bg;
                elements.fgColorText.value = fg;
                elements.bgColorText.value = bg;
                
                generateQR();
            });
        });
    }

    // Action buttons
    function setupActionButtons() {
        elements.downloadPng.addEventListener('click', downloadAsPNG);
        elements.downloadSvg.addEventListener('click', downloadAsSVG);
        elements.copyClipboard.addEventListener('click', copyToClipboard);
    }

    // Get content based on current type
    function getContent() {
        switch (currentType) {
            case 'text':
                return elements.textInput.value.trim();
            
            case 'url':
                let url = elements.urlInput.value.trim();
                // Auto-add https:// if no protocol
                if (url && !url.match(/^https?:\/\//i)) {
                    url = 'https://' + url;
                }
                return url;
            
            case 'wifi':
                const ssid = elements.wifiSsid.value.trim();
                const password = elements.wifiPassword.value;
                const encryption = elements.wifiEncryption.value;
                const hidden = elements.wifiHidden.checked;
                
                if (!ssid) return '';
                
                // WiFi QR code format: WIFI:T:WPA;S:mynetwork;P:mypass;H:true;;
                let wifiString = `WIFI:T:${encryption};S:${escapeWifiString(ssid)};`;
                if (encryption !== 'nopass' && password) {
                    wifiString += `P:${escapeWifiString(password)};`;
                }
                if (hidden) {
                    wifiString += 'H:true;';
                }
                wifiString += ';';
                return wifiString;
            
            case 'email':
                const email = elements.emailAddress.value.trim();
                const subject = elements.emailSubject.value.trim();
                const body = elements.emailBody.value.trim();
                
                if (!email) return '';
                
                let mailto = `mailto:${email}`;
                const params = [];
                if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
                if (body) params.push(`body=${encodeURIComponent(body)}`);
                if (params.length) mailto += '?' + params.join('&');
                
                return mailto;
            
            default:
                return '';
        }
    }

    // Escape special characters in WiFi strings
    function escapeWifiString(str) {
        return str.replace(/([\\;,:"])/g, '\\$1');
    }

    // Generate QR code using QRious
    function generateQR() {
        const content = getContent();
        
        if (!content) {
            hideQR();
            return;
        }

        const size = parseInt(elements.qrSize.value);
        const level = elements.errorCorrection.value;
        const foreground = elements.fgColor.value;
        const background = elements.bgColor.value;

        // Clear previous QR code
        elements.qrContainer.innerHTML = '';

        // Create canvas element
        const canvas = document.createElement('canvas');
        elements.qrContainer.appendChild(canvas);

        // Create QR code using QRious
        try {
            currentQr = new QRious({
                element: canvas,
                value: content,
                size: size,
                level: level,
                foreground: foreground,
                background: background,
                padding: 16
            });

            showQR();
        } catch (error) {
            console.error('QR generation error:', error);
            hideQR();
        }
    }

    // Show QR code
    function showQR() {
        elements.qrPlaceholder.style.display = 'none';
        elements.qrContainer.classList.add('active');
        
        elements.downloadPng.disabled = false;
        elements.downloadSvg.disabled = false;
        elements.copyClipboard.disabled = false;
    }

    // Hide QR code
    function hideQR() {
        elements.qrPlaceholder.style.display = 'block';
        elements.qrContainer.classList.remove('active');
        elements.qrContainer.innerHTML = '';
        
        elements.downloadPng.disabled = true;
        elements.downloadSvg.disabled = true;
        elements.copyClipboard.disabled = true;
        
        currentQr = null;
    }

    // Download as PNG
    function downloadAsPNG() {
        if (!currentQr) return;

        const canvas = elements.qrContainer.querySelector('canvas');
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `qrcode-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // Download as SVG (generate SVG from canvas data)
    function downloadAsSVG() {
        if (!currentQr) return;

        const content = getContent();
        const size = parseInt(elements.qrSize.value);
        const foreground = elements.fgColor.value;
        const background = elements.bgColor.value;

        // Generate SVG using the QR matrix data
        const svg = generateSVG(content, size, foreground, background);
        
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `qrcode-${Date.now()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    // Generate SVG from QR data
    function generateSVG(content, size, foreground, background) {
        // Create a temporary QRious to get the data
        const tempCanvas = document.createElement('canvas');
        const tempQr = new QRious({
            element: tempCanvas,
            value: content,
            size: 256,
            level: elements.errorCorrection.value,
            foreground: '#000000',
            background: '#ffffff',
            padding: 0
        });

        // Get the raw module count from canvas analysis
        const ctx = tempCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, 256, 256);
        
        // Find the QR code module size by detecting the first module
        let moduleSize = 1;
        for (let i = 0; i < 256; i++) {
            const idx = i * 4;
            if (imageData.data[idx] < 128) {
                // Found first black pixel, now find width
                let end = i;
                for (let j = i; j < 256; j++) {
                    const jdx = j * 4;
                    if (imageData.data[jdx] >= 128) {
                        end = j;
                        break;
                    }
                }
                moduleSize = end - i;
                break;
            }
        }

        const modules = Math.round(256 / moduleSize);
        const cellSize = size / modules;
        const padding = 16;
        const totalSize = size + padding * 2;

        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">
  <rect width="100%" height="100%" fill="${background}"/>
  <g transform="translate(${padding}, ${padding})">`;

        // Analyze canvas to build SVG paths
        for (let y = 0; y < modules; y++) {
            for (let x = 0; x < modules; x++) {
                const px = Math.floor(x * moduleSize + moduleSize / 2);
                const py = Math.floor(y * moduleSize + moduleSize / 2);
                const idx = (py * 256 + px) * 4;
                
                if (imageData.data[idx] < 128) {
                    svgContent += `\n    <rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${foreground}"/>`;
                }
            }
        }

        svgContent += `
  </g>
</svg>`;

        return svgContent;
    }

    // Copy to clipboard
    async function copyToClipboard() {
        if (!currentQr) return;

        const canvas = elements.qrContainer.querySelector('canvas');
        if (!canvas) return;

        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            showToast('Copied to clipboard!');
        } catch (error) {
            // Fallback: copy data URL
            try {
                await navigator.clipboard.writeText(canvas.toDataURL('image/png'));
                showToast('Copied as data URL!');
            } catch (e) {
                console.error('Copy failed:', e);
                showToast('Copy failed. Try downloading instead.');
            }
        }
    }

    // Show toast notification
    function showToast(message) {
        const toastText = elements.toast.querySelector('span');
        if (toastText) toastText.textContent = message;
        
        elements.toast.classList.add('show');
        
        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 2500);
    }

    // Utility: Debounce function
    function debounce(func, wait) {
        return function executedFunction(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Utility: Validate hex color
    function isValidHex(hex) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
