document.addEventListener('DOMContentLoaded', () => {
    const agree = document.getElementById('agree');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const status = document.getElementById('status');
    const stats = document.getElementById('live-stats');
    const form = document.getElementById('flood-form');
    const uaSelect = document.getElementById('ua-profile');
    const customRow = document.getElementById('custom-ua-row');

    agree.addEventListener('change', () => {
        startBtn.disabled = !agree.checked;
        status.textContent = agree.checked ? 'Ready to launch.' : 'Agree to rules first.';
    });

    uaSelect.addEventListener('change', () => {
        customRow.style.display = uaSelect.value === 'custom' ? 'block' : 'none';
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
            payload: document.getElementById('payload').value.trim()
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
            if (!r.ok) throw new Error(await r.text());
            status.textContent = 'KOHSEC TOOL RUNNING...';
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
                stats.innerHTML =
                    `Running: ${elapsed}s / ${s.duration || '?'}s\n` +
                    `Requests: ${s.requestsSent.toLocaleString()}\n` +
                    `Errors: ${s.errors || 0}`;
            } else {
                stats.innerHTML = '';
            }
        } catch { }
    }, 1800);
});