const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');

function addMessage(text, sender) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', sender);

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

// Load conversation history from Supabase on startup
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();

    if (data.messages && data.messages.length > 0) {
      // Remove the default welcome bubble before loading history
      messagesEl.innerHTML = '';
      for (const msg of data.messages) {
        const sender = msg.role === 'user' ? 'user' : 'v';
        addMessage(msg.content, sender);
      }
    }
  } catch (err) {
    console.error('Could not load history:', err);
    // Leave the welcome message in place if history fails
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;
  inputEl.disabled = true;

  const loadingBubble = addMessage('...', 'v');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    const reply = data.reply ?? `Error: ${data.error ?? 'Unknown error'}`;
    loadingBubble.textContent = reply;

  } catch {
    loadingBubble.textContent = "Couldn't reach V. Check your connection.";
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Load history when the page opens
loadHistory();
