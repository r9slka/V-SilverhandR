// ─── Elements ───────────────────────────────────────────────────────────────
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

// Pending file attachment
let pendingFile = null; // { fileType, fileData, fileName }

// ─── Chat helpers ────────────────────────────────────────────────────────────
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

// ─── Load chat history on startup ────────────────────────────────────────────
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (data.messages && data.messages.length > 0) {
      messagesEl.innerHTML = '';
      for (const msg of data.messages) {
        addMessage(msg.content, msg.role === 'user' ? 'user' : 'v');
      }
    }
  } catch (err) {
    console.error('Could not load history:', err);
  }
}

// ─── Send message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text && !pendingFile) return;

  if (pendingFile) addFileBubble(pendingFile.fileName);
  if (text) addMessage(text, 'user');

  inputEl.value = '';
  sendBtn.disabled = true;
  inputEl.disabled = true;

  const loadingBubble = addMessage('...', 'v');

  const body = { message: text };
  if (pendingFile) {
    body.fileType = pendingFile.fileType;
    body.fileData = pendingFile.fileData;
    body.fileName = pendingFile.fileName;
  }
  pendingFile = null;

  try {
    const res = await fetch('/api/chat', {
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
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ─── File upload ──────────────────────────────────────────────────────────────
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileInput.value = '';

  const ext = file.name.split('.').pop().toLowerCase();

  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
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
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text.trim();
}

// ─── Memory Panel ─────────────────────────────────────────────────────────────
memoryBtn.addEventListener('click', openPanel);
closePanelBtn.addEventListener('click', closePanel);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });

function openPanel() {
  overlay.classList.add('open');
  loadPanel();
}

function closePanel() {
  overlay.classList.remove('open');
}

async function loadPanel() {
  notesList.innerHTML = '<p class="empty-state">Loading...</p>';
  memoriesList.innerHTML = '<p class="empty-state">Loading...</p>';

  try {
    const [notesRes, memoriesRes] = await Promise.all([
      fetch('/api/notes'),
      fetch('/api/memory')
    ]);
    const notesData    = await notesRes.json();
    const memoriesData = await memoriesRes.json();
    renderNotes(notesData.notes ?? []);
    renderMemories(memoriesData.messages ?? []);
  } catch (err) {
    notesList.innerHTML = '<p class="empty-state">Failed to load.</p>';
    memoriesList.innerHTML = '<p class="empty-state">Failed to load.</p>';
  }
}

// ─── Notes ────────────────────────────────────────────────────────────────────
function renderNotes(notes) {
  if (!notes.length) {
    notesList.innerHTML = '<p class="empty-state">No notes yet.</p>';
    return;
  }
  notesList.innerHTML = '';
  for (const note of notes) {
    notesList.appendChild(buildNoteCard(note));
  }
}

function buildNoteCard(note) {
  const card = document.createElement('div');
  card.classList.add('card');
  card.dataset.id = note.id;

  const content = document.createElement('div');
  content.classList.add('card-content');
  content.textContent = note.content;

  const footer = document.createElement('div');
  footer.classList.add('card-footer');

  const date = document.createElement('span');
  date.classList.add('card-date');
  date.textContent = formatDate(note.created_at);

  const actions = document.createElement('div');
  actions.classList.add('card-actions');

  const editBtn = document.createElement('button');
  editBtn.classList.add('card-btn');
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => startEditNote(card, note));

  const delBtn = document.createElement('button');
  delBtn.classList.add('card-btn', 'delete');
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteNote(note.id, card));

  actions.append(editBtn, delBtn);
  footer.append(date, actions);
  card.append(content, footer);
  return card;
}

function startEditNote(card, note) {
  card.innerHTML = '';

  const textarea = document.createElement('textarea');
  textarea.classList.add('card-edit-area');
  textarea.value = note.content;
  textarea.rows = 3;

  const saveBtn = document.createElement('button');
  saveBtn.classList.add('card-save-btn');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const newContent = textarea.value.trim();
    if (!newContent) return;
    await fetch('/api/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: note.id, content: newContent })
    });
    note.content = newContent;
    card.replaceWith(buildNoteCard(note));
  });

  card.append(textarea, saveBtn);
  textarea.focus();
}

async function deleteNote(id, card) {
  await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
  card.remove();
  if (!notesList.querySelector('.card')) {
    notesList.innerHTML = '<p class="empty-state">No notes yet.</p>';
  }
}

addNoteBtn.addEventListener('click', async () => {
  const content = newNoteInput.value.trim();
  if (!content) return;
  newNoteInput.value = '';
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  const data = await res.json();
  if (data.note) {
    const empty = notesList.querySelector('.empty-state');
    if (empty) empty.remove();
    notesList.appendChild(buildNoteCard(data.note));
  }
});

// ─── Memories ─────────────────────────────────────────────────────────────────
function renderMemories(messages) {
  if (!messages.length) {
    memoriesList.innerHTML = '<p class="empty-state">No conversation history yet.</p>';
    return;
  }
  memoriesList.innerHTML = '';
  // Show newest first in the panel
  for (const msg of [...messages].reverse()) {
    memoriesList.appendChild(buildMemoryCard(msg));
  }
}

function buildMemoryCard(msg) {
  const card = document.createElement('div');
  card.classList.add('card');
  card.dataset.id = msg.id;

  const content = document.createElement('div');
  content.classList.add('card-content');
  content.textContent = msg.content;
  if (content.textContent.length > 200) {
    content.textContent = content.textContent.slice(0, 200) + '…';
  }

  const footer = document.createElement('div');
  footer.classList.add('card-footer');

  const info = document.createElement('span');
  info.classList.add('card-date');
  info.textContent = `${msg.role === 'user' ? 'You' : 'V'} · ${formatDate(msg.created_at)}`;

  const actions = document.createElement('div');
  actions.classList.add('card-actions');

  const editBtn = document.createElement('button');
  editBtn.classList.add('card-btn');
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => startEditMemory(card, msg));

  const delBtn = document.createElement('button');
  delBtn.classList.add('card-btn', 'delete');
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteMemory(msg.id, card));

  actions.append(editBtn, delBtn);
  footer.append(info, actions);
  card.append(content, footer);
  return card;
}

function startEditMemory(card, msg) {
  card.innerHTML = '';

  const textarea = document.createElement('textarea');
  textarea.classList.add('card-edit-area');
  textarea.value = msg.content;
  textarea.rows = 3;

  const saveBtn = document.createElement('button');
  saveBtn.classList.add('card-save-btn');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const newContent = textarea.value.trim();
    if (!newContent) return;
    await fetch('/api/memory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: msg.id, content: newContent })
    });
    msg.content = newContent;
    card.replaceWith(buildMemoryCard(msg));
  });

  card.append(textarea, saveBtn);
  textarea.focus();
}

async function deleteMemory(id, card) {
  await fetch(`/api/memory?id=${id}`, { method: 'DELETE' });
  card.remove();
  if (!memoriesList.querySelector('.card')) {
    memoriesList.innerHTML = '<p class="empty-state">No conversation history yet.</p>';
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadHistory();
