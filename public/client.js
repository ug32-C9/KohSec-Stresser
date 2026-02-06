document.addEventListener('DOMContentLoaded', () => {
    const agree = document.getElementById('agree');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const status = document.getElementById('status');
    const stats = document.getElementById('live-stats');
    const form = document.getElementById('flood-form');
    const uaSelect = document.getElementById('ua-profile');
    const customRow = document.getElementById('custom-ua-row');
    const proxyFile = document.getElementById('proxy-file');
    const proxyCount = document.getElementById('proxy-count');
    const clearProxies = document.getElementById('clear-proxies');

    let loadedProxies = '';

    agree.addEventListener('change', () => {
        startBtn.disabled = !agree.checked;
        status.textContent = agree.checked ? 'Ready to launch.' : 'Agree to rules first.';
    });

    uaSelect.addEventListener('change', () => {
        customRow.style.display = uaSelect.value === 'custom' ? 'block' : 'none';
    });

    // Handle proxy file upload
    proxyFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => {
                const trimmed = line.trim();
                return trimmed && !trimmed.startsWith('#');
            });

            loadedProxies = text;
            const httpCount = lines.filter(l => l.includes('http://')).length;
            const socksCount = lines.filter(l => l.includes('socks')).length;

            proxyCount.textContent = `✓ ${lines.length} proxies loaded (${httpCount} HTTP, ${socksCount} SOCKS)`;
            proxyCount.classList.add('loaded');
            clearProxies.style.display = 'inline-block';
        } catch (err) {
            proxyCount.textContent = 'Error reading file';
            proxyCount.classList.remove('loaded');
            loadedProxies = '';
        }
    });

    // Clear proxies
    clearProxies.addEventListener('click', () => {
        loadedProxies = '';
        proxyFile.value = '';
        proxyCount.textContent = 'No proxies loaded';
        proxyCount.classList.remove('loaded');
        clearProxies.style.display = 'none';
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!agree.checked) return;

        const data = {
            target: document.getElementById('target').value.trim(),
            threads: document.getElementById('threads').value,
            duration: document.getElementById('duration').value,
            uaProfile: uaSelect.value,
            customUA: uaSelect.value === 'custom' ? document.getElementById('custom-ua').value.trim() : '',
            payload: document.getElementById('payload').value.trim(),
            proxyList: loadedProxies
        };

        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = 'Starting...';
        status.className = 'status-box running';

        try {
            const r = await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await r.json();
            if (!r.ok) throw new Error(result.error || 'Failed to start');

            const proxyInfo = result.proxiesLoaded > 0 ? ` (${result.proxiesLoaded} proxies)` : ' (direct)';
            status.textContent = `KOHSEC TOOL RUNNING${proxyInfo}...`;
        } catch (err) {
            status.textContent = 'Error: ' + err.message;
            status.className = 'status-box error';
            startBtn.disabled = false;
            stopBtn.disabled = true;
        }
    });

    stopBtn.addEventListener('click', async () => {
        await fetch('/api/stop', { method: 'POST' });
        startBtn.disabled = false;
        stopBtn.disabled = true;
        status.textContent = 'KohSec Tool stopped.';
        status.className = 'status-box';
    });

    // Live stats polling
    setInterval(async () => {
        try {
            const r = await fetch('/api/status');
            const s = await r.json();
            if (s.running) {
                const elapsed = ((Date.now() - s.startTime) / 1000).toFixed(1);
                const proxyLine = s.proxyCount > 0
                    ? `Proxies: ${s.proxyCount} | Rotations: ${s.proxyRotations || 0}\n`
                    : '';
                stats.innerHTML =
                    `Running: ${elapsed}s\n` +
                    `Requests: ${s.requestsSent.toLocaleString()}\n` +
                    `Errors: ${s.errors || 0}\n` +
                    proxyLine;
            } else {
                stats.innerHTML = '';
            }
        } catch { }
    }, 1800);
});