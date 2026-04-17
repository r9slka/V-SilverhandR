const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send-btn');

const history = [];

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

function setLoading(bubble, on) {
  bubble.textContent = on ? '...' : '';
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  history.push({ role: 'user', text });
  inputEl.value = '';
  sendBtn.disabled = true;
  inputEl.disabled = true;

  const loadingBubble = addMessage('...', 'v');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(0, -1) })
    });

    const data = await res.json();
    const reply = data.reply ?? "Something went wrong.";

    loadingBubble.textContent = reply;
    history.push({ role: 'model', text: reply });
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
