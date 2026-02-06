const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let activeTest = null;

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
    if (profile === 'custom') return null; // handled client-side
    const list = uaPresets[profile] || uaPresets.windows;
    return list[Math.floor(Math.random() * list.length)];
}

app.post('/api/start', (req, res) => {
    if (activeTest) {
        return res.status(400).json({ error: 'Test already running' });
    }

    let { target, threads, duration, uaProfile, customUA, payload } = req.body;

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

    console.log(`[START] ${target} | threads:${threads} | dur:${duration}s | ua:${uaProfile}`);

    activeTest = {
        running: true,
        startTime: Date.now(),
         requestsSent: 0,
         errors: 0,
         endTime: Date.now() + duration * 1000
    };

    const protocol = targetUrl.protocol === 'https:' ? https : http;

    function sendRequest() {
        if (!activeTest?.running || Date.now() >= activeTest.endTime) return;

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

        const req = protocol.request(options, (res) => {
            res.on('data', () => {});
            activeTest.requestsSent++;
        });

        req.on('error', () => {
            activeTest.errors++;
            activeTest.requestsSent++;
        });

        if (payload) req.write(payload);
        req.end();

        setTimeout(sendRequest, 1000 / (threads * 1.5)); // slight jitter + distribute
    }

    // Launch threads
    for (let i = 0; i < threads; i++) {
        setTimeout(sendRequest, i * 150); // stagger start
    }

    // Auto-stop safety
    setTimeout(() => {
        if (activeTest) {
            activeTest.running = false;
            activeTest = null;
            console.log('[AUTO-STOP] Safety timeout');
        }
    }, duration * 1000 + 10000);

    res.json({ status: 'started' });
});

app.post('/api/stop', (req, res) => {
    if (activeTest) {
        activeTest.running = false;
        const wasSent = activeTest.requestsSent;
        activeTest = null;
        console.log(`[STOP] Aborted – ${wasSent} requests sent`);
        return res.json({ status: 'stopped' });
    }
    res.json({ status: 'idle' });
});

app.get('/api/status', (req, res) => {
    res.json(activeTest || { running: false, requestsSent: 0, errors: 0 });
});

app.listen(port, () => {
    console.log(`KOHSEC Stress Tool → http://localhost:${port}`);
});
