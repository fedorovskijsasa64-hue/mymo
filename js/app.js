// ===== Состояние =====
let currentUser = '';
let currentFilter = 'none';
let messages = [];
let authMode = 'login'; // 'login' | 'register'

// ===== Ключи хранилища =====
const STORAGE_KEY = 'retrogram_messages';
const USERS_KEY = 'retrogram_users';     // { логин: hash }
const SESSION_KEY = 'retrogram_session'; // текущая сессия
const REMEMBER_KEY = 'retrogram_remember'; // сохранённый логин

// ===== DOM =====
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const rememberMe = document.getElementById('rememberMe');
const submitBtn = document.getElementById('submitBtn');
const authError = document.getElementById('authError');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const logoutBtn = document.getElementById('logoutBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesEl = document.getElementById('messages');
const filterBtn = document.getElementById('filterBtn');
const filterPanel = document.getElementById('filterPanel');
const chatWith = document.getElementById('chatWith');

// ===== Утилиты =====
async function hashPassword(password) {
    // SHA-256 через Web Crypto (работает в браузере и на телефоне)
    const data = new TextEncoder().encode(password + '::retrogram_salt');
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch { return {}; }
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function shake(el) {
    el.style.animation = 'none';
    setTimeout(() => { el.style.animation = 'shake 0.4s'; }, 10);
}

// ===== Вкладки Вход / Регистрация =====
function setMode(mode) {
    authMode = mode;
    authError.textContent = '';
    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        submitBtn.textContent = 'Войти';
        passwordInput.autocomplete = 'current-password';
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        submitBtn.textContent = 'Зарегистрироваться';
        passwordInput.autocomplete = 'new-password';
    }
}

tabLogin.addEventListener('click', () => setMode('login'));
tabRegister.addEventListener('click', () => setMode('register'));

// ===== Логин / Регистрация =====
submitBtn.addEventListener('click', handleAuth);
passwordInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleAuth(); });
usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') passwordInput.focus(); });

async function handleAuth() {
    authError.textContent = '';
    const name = usernameInput.value.trim();
    const pass = passwordInput.value;

    if (name.length < 2) {
        authError.textContent = 'Логин должен быть не короче 2 символов';
        shake(loginScreen.querySelector('.login-box'));
        return;
    }
    if (pass.length < 4) {
        authError.textContent = 'Пароль должен быть не короче 4 символов';
        shake(loginScreen.querySelector('.login-box'));
        return;
    }

    submitBtn.disabled = true;
    try {
        const hash = await hashPassword(pass);
        const users = getUsers();

        if (authMode === 'register') {
            if (users[name]) {
                authError.textContent = 'Такой логин уже занят';
                shake(loginScreen.querySelector('.login-box'));
                return;
            }
            users[name] = hash;
            saveUsers(users);
            // после регистрации сразу входим
            completeLogin(name);
        } else {
            if (!users[name]) {
                authError.textContent = 'Пользователь не найден';
                shake(loginScreen.querySelector('.login-box'));
                return;
            }
            if (users[name] !== hash) {
                authError.textContent = 'Неверный пароль';
                shake(loginScreen.querySelector('.login-box'));
                return;
            }
            completeLogin(name);
        }
    } finally {
        submitBtn.disabled = false;
    }
}

function completeLogin(name) {
    currentUser = name;
    localStorage.setItem(SESSION_KEY, name);

    // «Запомнить меня»
    if (rememberMe.checked) {
        localStorage.setItem(REMEMBER_KEY, name);
    } else {
        localStorage.removeItem(REMEMBER_KEY);
    }

    passwordInput.value = '';
    showChat();
    addSystemMessage(`${name} присоединился к чату`);
}

// ===== Выход =====
logoutBtn.addEventListener('click', () => {
    if (confirm('Выйти из чата?')) {
        currentUser = '';
        localStorage.removeItem(SESSION_KEY);
        // логин из поля "Запомнить" сохраняется, чтобы было проще входить снова
        const remembered = localStorage.getItem(REMEMBER_KEY);
        usernameInput.value = remembered || '';
        passwordInput.value = '';
        rememberMe.checked = !!remembered;
        chatScreen.classList.remove('active');
        loginScreen.classList.add('active');
        setMode('login');
    }
});

// ===== Переключение экранов =====
function showChat() {
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');
    chatWith.textContent = 'Общий чат';
    renderMessages();
    messageInput.focus();
}

// ===== Сообщения =====
function loadMessages() {
    try { messages = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { messages = []; }
}

function saveMessages() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;

    messages.push({
        id: Date.now() + Math.random(),
        author: currentUser,
        text: text,
        filter: currentFilter,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    });

    saveMessages();
    renderMessages();
    messageInput.value = '';
    messageInput.focus();
}

function addSystemMessage(text) {
    messages.push({
        id: Date.now() + Math.random(),
        system: true,
        text: text,
        time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    });
    saveMessages();
    renderMessages();
}

function renderMessages() {
    messagesEl.innerHTML = '';

    if (messages.length === 0) {
        messagesEl.innerHTML = '<div class="system-msg">Начни общение 👋</div>';
        return;
    }

    messages.forEach(msg => {
        if (msg.system) {
            const div = document.createElement('div');
            div.className = 'system-msg';
            div.textContent = msg.text;
            messagesEl.appendChild(div);
            return;
        }

        const div = document.createElement('div');
        const isOwn = msg.author === currentUser;
        div.className = `message ${isOwn ? 'own' : 'other'}`;
        if (msg.filter && msg.filter !== 'none') div.classList.add(`filter-${msg.filter}`);

        div.innerHTML = `
            ${!isOwn ? `<div class="author">${escapeHtml(msg.author)}</div>` : ''}
            <div>${escapeHtml(msg.text)}</div>
            <div class="time">${msg.time}</div>
        `;
        messagesEl.appendChild(div);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ===== Фильтры =====
filterBtn.addEventListener('click', () => filterPanel.classList.toggle('active'));
filterPanel.querySelectorAll('span').forEach(span => {
    span.addEventListener('click', () => {
        filterPanel.querySelectorAll('span').forEach(s => s.classList.remove('active'));
        span.classList.add('active');
        currentFilter = span.dataset.filter;
    });
});

// ===== Синхронизация между вкладками =====
window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
        loadMessages();
        renderMessages();
    }
});

// ===== Инициализация =====
function init() {
    loadMessages();

    // Подставляем сохранённый логин
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) {
        usernameInput.value = remembered;
        rememberMe.checked = true;
    }

    // Автовход по активной сессии (если браузер закрыт — сессия сбрасывается,
    // но если пользователь выбрал "Запомнить меня", логин уже в поле ввода)
    const session = localStorage.getItem(SESSION_KEY);
    if (session && getUsers()[session]) {
        currentUser = session;
        showChat();
    }

    // shake-анимация
    const st = document.createElement('style');
    st.textContent = `@keyframes shake {
        0%,100% { transform: translateX(0); }
        25% { transform: translateX(-6px); }
        75% { transform: translateX(6px); }
    }`;
    document.head.appendChild(st);
}

init();