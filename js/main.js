// === UTILS ===

// URL сервера с бэком Spring (порт по умолчанию 8080)
const API_ROOT = 'http://localhost:8080';

// Получаем заголовок с токеном JWT


function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// Универсальная функция fetch с JSON
async function apiFetch(path, options = {}) {
  const defaultHeaders = { 'Content-Type': 'application/json', ...getAuthHeader() };
  const res = await fetch(`${API_ROOT}${path}`, {
    headers: defaultHeaders,
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'API error ' + res.status);
  }
  return res.json();
}


// Парсим query-параметры, например ?id=5
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// === INDEX.HTML ===
async function loadTopics() {
  try {
    const topics = await apiFetch('/api/topics');
    const list = document.querySelector('.list-group');
    list.innerHTML = '';
    topics.forEach(t => {
      const a = document.createElement('a');
      a.className = 'list-group-item list-group-item-action';
      a.href = `topic.html?id=${t.id}`;
      a.innerHTML = `
        📌 [${t.category}] ${t.title}
        <small class="text-muted d-block">
          Автор: ${t.authorUsername} | Ответов: ${t.commentCount} | Дата: ${new Date(t.createdAt).toLocaleDateString()}
        </small>`;
      list.append(a);
    });
  } catch (e) {
    console.error(e);
  }
}

// === LOGIN.HTML ===
async function handleLogin() {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          usernameOrEmail: e.target.email.value,
          password: e.target.password.value
        })
      });
      localStorage.setItem('token', res.token);
      window.location.href = 'index.html';
    } catch (err) {
      alert('Ошибка входа: ' + err.message);
    }
  });
}

// === REGISTER.HTML ===
async function handleRegister() {
  const form = document.getElementById('registerForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: e.target.username.value,
          email: e.target.email.value,
          password: e.target.password.value,
          role: e.target.role.value
        })
      });
      window.location.href = 'login.html';
    } catch (err) {
      alert('Ошибка регистрации: ' + err.message);
    }
  });
}

// === PROFILE.HTML ===
async function loadProfile() {
  try {
    const user = await apiFetch('/api/users/me');
    // Заполняем поля
    document.getElementById('username').value = user.username;
    document.getElementById('email').value = user.email;
    document.getElementById('bio').value = user.bio || '';
    document.getElementById('faculty').value = user.faculty || '';
    document.getElementById('group').value = user.group || '';
    if (user.photoUrl) document.getElementById('profilePhoto').src = user.photoUrl;

    // Список тем
    const topics = await apiFetch('/api/users/me/topics');
    const ut = document.getElementById('userTopics');
    ut.innerHTML = '';
    topics.forEach(t => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `<a href="topic.html?id=${t.id}">${t.title}</a>`;
      ut.append(li);
    });

    // Список комментариев
    const comments = await apiFetch('/api/users/me/comments');
    const uc = document.getElementById('userComments');
    uc.innerHTML = '';
    comments.forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `${c.text.slice(0, 50)}... <a href="topic.html?id=${c.topicId}">Читать</a>`;
      uc.append(li);
    });
  } catch (e) {
    console.error(e);
  }
}

async function handleProfileUpdate() {
  const form = document.getElementById('profileForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          bio: e.target.bio.value,
          faculty: e.target.faculty.value,
          group: e.target.group.value
        })
      });
      alert('Профиль обновлён');
    } catch (err) {
      alert('Ошибка обновления: ' + err.message);
    }
  });
}

// === TOPIC.HTML ===
async function loadTopic() {
  const id = getQueryParam('id');
  try {
    const t = await apiFetch(`/api/topics/${id}`);
    document.getElementById('topicTitle').textContent = `[${t.category}] ${t.title}`;
    document.getElementById('topicMeta').textContent = `Автор: ${t.authorUsername} | ${new Date(t.createdAt).toLocaleString()}`;
    document.getElementById('topicContent').innerHTML = t.content;

    // Построение дерева комментариев
    const commentTree = buildCommentTree(t.comments);
    const list = document.getElementById('commentsList');
    list.innerHTML = '';
    commentTree.forEach(comment => renderComment(comment, list));
  } catch (e) {
    console.error(e);
  }
}
// Преобразует плоский массив в дерево
function buildCommentTree(comments) {
  const map = new Map();
  const roots = [];
  
  comments.forEach(comment => {
    comment.replies = [];
    map.set(comment.id, comment);
  });
  
  comments.forEach(comment => {
    if (comment.parentId) {
      const parent = map.get(comment.parentId);
      parent?.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });
  
  return roots;
}

function renderComment(c, container) {
  const div = document.createElement('div');
  div.className = 'media mb-3';
  div.innerHTML = `
    <img src="${c.authorPhotoUrl || 'https://via.placeholder.com/50'}" class="me-3 rounded-circle" alt="Аватар">
    <div class="media-body">
      <h6 class="mt-0">${c.authorUsername} <small class="text-muted">— ${new Date(c.createdAt).toLocaleString()}</small></h6>
      <p>${c.text}</p>
      <div>
        <button class="btn btn-sm btn-outline-success">👍 <span>${c.likes}</span></button>
        <button class="btn btn-sm btn-outline-danger">👎 <span>${c.dislikes}</span></button>
        <button class="btn btn-sm btn-outline-secondary">Цитировать</button>
        <button class="btn btn-sm btn-outline-warning">Пожаловаться</button>
      </div>
      <div class="replies mt-3 ms-4" id="replies-${c.id}"></div>
    </div>`;
  
  // Рекурсивно отображаем ответы
  const repliesContainer = div.querySelector(`#replies-${c.id}`);
  c.replies.forEach(reply => renderComment(reply, repliesContainer));
  
  container.appendChild(div);
}

async function handleCommentSubmit() {
  const form = document.getElementById('commentForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = getQueryParam('id');
    try {
      const newC = await apiFetch(`/api/topics/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: e.target.commentText.value })
      });
      renderComment(newC);
      form.reset();
    } catch (err) {
      alert('Ошибка отправки комментария: ' + err.message);
    }
  });
}

// === CREATE-TOPIC.HTML ===
async function loadCategories() {
  try {
    const cats = await apiFetch('/api/categories');
    const sel = document.getElementById('category');
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.displayName;
      sel.append(opt);
    });
  } catch (e) {
    console.error(e);
  }
}

async function handleCreateTopic() {
  const form = document.getElementById('createTopicForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const data = {
        category: e.target.category.value,
        title: e.target.title.value,
        content: e.target.content.value
      };
      const res = await apiFetch('/api/topics', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      window.location.href = `topic.html?id=${res.id}`;
    } catch (err) {
      alert('Ошибка создания темы: ' + err.message);
    }
  });
}

// === ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ===
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.split('/').pop();
  switch (path) {
    case 'index.html':
      loadTopics();
      break;
    case 'login.html':
      handleLogin();
      break;
    case 'register.html':
      handleRegister();
      break;
    case 'profile.html':
      loadProfile();
      handleProfileUpdate();
      break;
    case 'topic.html':
      loadTopic();
      handleCommentSubmit();
      break;
    case 'create-topic.html':
      loadCategories();
      handleCreateTopic();
      break;
  }
});
