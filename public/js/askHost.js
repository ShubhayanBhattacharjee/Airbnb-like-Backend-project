document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('askHostBtn');
    const modal = document.getElementById('askHostModal');
    const closeBtn = document.getElementById('askHostClose');
    const sendBtn = document.getElementById('askHostSend');
    const textarea = document.getElementById('askHostMessage');
    const status = document.getElementById('askHostStatus');
    if (!btn || !modal) return;

    const homeId = window.__homeId; // set inline in homeDetails.ejs
    const csrfToken = window.__csrfToken || '';

    btn.addEventListener('click', () => { modal.hidden = false; });
    closeBtn.addEventListener('click', () => { modal.hidden = true; });

    sendBtn.addEventListener('click', async () => {
        const message = textarea.value.trim();
        if (!message) {
            status.textContent = 'Please enter a question.';
            return;
        }
        sendBtn.disabled = true;
        status.textContent = 'Sending…';
        try {
            const res = await fetch('/inquiries/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrfToken },
                credentials: 'same-origin',
                body: JSON.stringify({ homeId, message })
            });
            const data = await res.json();
            status.textContent = data.message;
            if (data.success) {
                textarea.value = '';
                setTimeout(() => { modal.hidden = true; status.textContent = ''; }, 1500);
            }
        } catch (e) {
            status.textContent = 'Something went wrong. Please try again.';
        } finally {
            sendBtn.disabled = false;
        }
    });
});