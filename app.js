// ─── Elements ────────────────────────────────────────────────────────────────
const messagesEl   = document.getElementById('messages');
const inputEl      = document.getElementById('input');
const sendBtn      = document.getElementById('send-btn');
const memoryBtn    = document.getElementById('memory-btn');
const overlay      = document.getElementById('memory-overlay');
const closePanelBtn= document.getElementById('close-panel-btn');
const notesList    = document.getElementById('notes-list');
const memoriesList = document.getElementById('memories-list');
const newNoteInput = document.getElementById('new-note-input');
const addNoteBtn   = document.getElementById('add-note-btn');
const fileInput    = document.getElementById('file-input');

// PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let pendingFile = null;

// ─── Chat ─────────────────────────────────────────────────────────────────────
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

function addFileBubble(fileName) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', 'user');
  const bubble = document.createElement('div');
  bubble.classList.add('bubble', 'file-bubble');
  bubble.textContent = `📄 ${fileName}`;
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadHistory() {
  try {
    const res  = await fetch('/api/history');
    const data = await res.json();
    if (data.messages && data.messages.length > 0) {
      messagesEl.innerHTML = '';
      for (const msg of data.messages) {
        addMessage(msg.content, msg.role === 'user' ? 'user' : 'v');
      }
    }
  } catch (err) {
    console.error('History load failed:', err);
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text && !pendingFile) return;

  if (pendingFile) addFileBubble(pendingFile.fileName);
  if (text) addMessage(text, 'user');

  inputEl.value = '';
  inputEl.placeholder = 'Message V...';
  sendBtn.disabled = true;
  inputEl.disabled = true;

  const body = { message: text };
  if (pendingFile) {
    body.fileType = pendingFile.fileType;
    body.fileData = pendingFile.fileData;
    body.fileName = pendingFile.fileName;
  }
  pendingFile = null;

  const loadingBubble = addMessage('...', 'v');

  try {
    const res  = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    loadingBubble.textContent = data.reply ?? `Error: ${data.error ?? 'Unknown error'}`;
  } catch {
    loadingBubble.textContent = "Couldn't reach V. Check your connection.";
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ─── File upload ──────────────────────────────────────────────────────────────
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileInput.value = '';
  const ext = file.name.split('.').pop().toLowerCase();

  if (['jpg','jpeg','png','webp'].includes(ext)) {
    const base64 = await fileToBase64(file);
    pendingFile = { fileType: 'image', fileData: base64, fileName: file.name };
    inputEl.placeholder = `📎 ${file.name} — type a message or hit Send`;
    inputEl.focus();
  } else if (ext === 'pdf') {
    inputEl.placeholder = `⏳ Reading ${file.name}...`;
    try {
      const text = await extractPdfText(file);
      pendingFile = { fileType: 'pdf', fileData: text, fileName: file.name };
      inputEl.placeholder = `📎 ${file.name} — type a message or hit Send`;
    } catch (e) {
      inputEl.placeholder = 'Message V...';
      addMessage(`Couldn't read that PDF: ${e.message}`, 'v');
    }
    inputEl.focus();
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text.trim();
}

// ─── Memory Panel ─────────────────────────────────────────────────────────────
memoryBtn.addEventListener('click', openPanel);
closePanelBtn.addEventListener('click', closePanel);
overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

function openPanel() { overlay.classList.add('open'); loadPanel(); }
function closePanel() { overlay.classList.remove('open'); }

async function loadPanel() {
  notesList.innerHTML    = '<p class="empty-state">Loading...</p>';
  memoriesList.innerHTML = '<p class="empty-state">Loading...</p>';
  try {
    const [nr, mr] = await Promise.all([
      fetch('/api/notes').then(r => r.json()),
      fetch('/api/memory').then(r => r.json())
    ]);
    renderNotes(nr.notes ?? []);
    renderMemories(mr.messages ?? []);
  } catch {
    notesList.innerHTML    = '<p class="empty-state">Failed to load.</p>';
    memoriesList.innerHTML = '<p class="empty-state">Failed to load.</p>';
  }
}

// ─── Notes ────────────────────────────────────────────────────────────────────
function renderNotes(notes) {
  notesList.innerHTML = notes.length ? '' : '<p class="empty-state">No notes yet.</p>';
  notes.forEach(n => notesList.appendChild(buildNoteCard(n)));
}

function buildNoteCard(note) {
  const card    = document.createElement('div'); card.classList.add('card');
  const content = el('div', 'card-content', note.content);
  const footer  = document.createElement('div'); footer.classList.add('card-footer');
  const date    = el('span', 'card-date', fmtDate(note.created_at));
  const actions = document.createElement('div'); actions.classList.add('card-actions');
  actions.append(
    btn('Edit',   'card-btn',        () => startEditNote(card, note)),
    btn('Delete', 'card-btn delete', () => deleteNote(note.id, card))
  );
  footer.append(date, actions);
  card.append(content, footer);
  return card;
}

function startEditNote(card, note) {
  card.innerHTML = '';
  const ta   = textarea(note.content, 3);
  const save = btn('Save', 'card-save-btn', async () => {
    const v = ta.value.trim(); if (!v) return;
    await fetch('/api/notes', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id:note.id,content:v}) });
    note.content = v; card.replaceWith(buildNoteCard(note));
  });
  card.append(ta, save); ta.focus();
}

async function deleteNote(id, card) {
  await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
  card.remove();
  if (!notesList.querySelector('.card')) notesList.innerHTML = '<p class="empty-state">No notes yet.</p>';
}

addNoteBtn.addEventListener('click', async () => {
  const content = newNoteInput.value.trim(); if (!content) return;
  newNoteInput.value = '';
  const res  = await fetch('/api/notes', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({content}) });
  const data = await res.json();
  if (data.note) {
    notesList.querySelector('.empty-state')?.remove();
    notesList.appendChild(buildNoteCard(data.note));
  }
});

// ─── Memories ─────────────────────────────────────────────────────────────────
function renderMemories(messages) {
  memoriesList.innerHTML = messages.length ? '' : '<p class="empty-state">No conversation history yet.</p>';
  [...messages].reverse().forEach(m => memoriesList.appendChild(buildMemoryCard(m)));
}

function buildMemoryCard(msg) {
  const card    = document.createElement('div'); card.classList.add('card');
  const preview = msg.content.length > 200 ? msg.content.slice(0,200)+'…' : msg.content;
  const content = el('div', 'card-content', preview);
  const footer  = document.createElement('div'); footer.classList.add('card-footer');
  const info    = el('span', 'card-date', `${msg.role==='user'?'You':'V'} · ${fmtDate(msg.created_at)}`);
  const actions = document.createElement('div'); actions.classList.add('card-actions');
  actions.append(
    btn('Edit',   'card-btn',        () => startEditMemory(card, msg)),
    btn('Delete', 'card-btn delete', () => deleteMemory(msg.id, card))
  );
  footer.append(info, actions);
  card.append(content, footer);
  return card;
}

function startEditMemory(card, msg) {
  card.innerHTML = '';
  const ta   = textarea(msg.content, 3);
  const save = btn('Save', 'card-save-btn', async () => {
    const v = ta.value.trim(); if (!v) return;
    await fetch('/api/memory', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id:msg.id,content:v}) });
    msg.content = v; card.replaceWith(buildMemoryCard(msg));
  });
  card.append(ta, save); ta.focus();
}

async function deleteMemory(id, card) {
  await fetch(`/api/memory?id=${id}`, { method: 'DELETE' });
  card.remove();
  if (!memoriesList.querySelector('.card')) memoriesList.innerHTML = '<p class="empty-state">No conversation history yet.</p>';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function el(tag, cls, text) {
  const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e;
}
function btn(text, cls, onClick) {
  const b = document.createElement('button'); b.className = cls; b.textContent = text; b.addEventListener('click', onClick); return b;
}
function textarea(value, rows) {
  const t = document.createElement('textarea'); t.className = 'card-edit-area'; t.value = value; t.rows = rows; return t;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ─── PWA service worker ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

// ─── Start ────────────────────────────────────────────────────────────────────
loadHistory();
