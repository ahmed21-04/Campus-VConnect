async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

let CURRENT_USER = null;

async function requireAuth() {
  try {
    const { user } = await api('/auth/me');
    CURRENT_USER = user;
    return user;
  } catch (e) {
    window.location.href = '/login.html';
    return null;
  }
}

/**
 * Read a File object and return a base64 data URL string.
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress/resize any image to a reasonable avatar size so photos of
 * ANY size can be uploaded (no file-size restriction for the user).
 */
function compressImage(file, maxDim = 640, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

/**
 * Upload a profile picture from a File input element.
 * No size restriction — large photos are automatically compressed.
 * Returns the updated user object.
 */
async function uploadProfilePicture(file) {
  if (!file) throw new Error('No file selected');
  if (!file.type.startsWith('image/')) throw new Error('Please select an image file');
  let dataUrl;
  try { dataUrl = await compressImage(file); }
  catch (_) { dataUrl = await fileToDataUrl(file); }
  const { user } = await api('/auth/me/profile-picture', {
    method: 'PUT',
    body: { profilePicture: dataUrl }
  });
  if (CURRENT_USER) CURRENT_USER.profilePicture = user.profilePicture;
  return user;
}

/**
 * Returns an <img> or initials-fallback element for a user's profile picture.
 * size: pixel size (number)
 */
function profilePicHtml(user, size = 32) {
  const s = `width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--brass);background:var(--chalk);`;
  if (user && user.profilePicture) {
    return `<img src="${user.profilePicture}" alt="${user.name}" style="${s}">`;
  }
  // Fallback: initials circle
  const initials = user && user.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'CC';
  const fontSize = Math.round(size * 0.36);
  return `<div style="${s}display:flex;align-items:center;justify-content:center;color:var(--parchment);font-family:var(--font-display);font-weight:700;font-size:${fontSize}px;">${initials}</div>`;
}

function renderNav(active) {
  if (!CURRENT_USER) return;
  const isStaff = CURRENT_USER.role === 'teacher' || CURRENT_USER.role === 'admin';
  const links = [
    { href: '/dashboard.html', label: 'Home',        key: 'home' },
    { href: '/departments.html', label: 'Departments', key: 'departments' },
    { href: '/teachers.html',    label: 'Professors',  key: 'teachers' },
    { href: '/calendar.html',    label: 'Calendar',    key: 'calendar' },
    { href: '/attendance.html',  label: 'Attendance',  key: 'attendance' },
    { href: '/performance.html', label: 'Performance', key: 'performance' },
    { href: '/guidelines.html',  label: 'Guidelines',  key: 'guidelines' },
    { href: '/chat.html',        label: 'Chat',        key: 'chat' },
  ];
  if (isStaff) links.push({ href: '/admin.html', label: 'Admin', key: 'admin' });

  // Left sidebar: brand + navigation links
  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  nav.innerHTML = `
    <a class="brand" href="/index.html" title="Campus Connect — front page">
      <div class="nav-seal">CC</div>
      <span>Campus Connect</span>
    </a>
    <div class="nav-links" id="navLinks">
      ${links.map(l => `<a href="${l.href}" class="${l.key === active ? 'active' : ''}">${l.label}${l.key === 'chat' ? '<span class="nav-chat-badge" id="navChatBadge" style="display:none"></span>' : ''}</a>`).join('')}
    </div>
    <button class="nav-burger" id="navBurger" aria-label="Toggle menu">&#9776;</button>
  `;

  // Top-right header: user name on top, Log out underneath
  const topBar = document.createElement('header');
  topBar.className = 'top-bar';
  topBar.innerHTML = `
    <div class="top-user">
      <div class="top-user-row">
        <a href="/profile.html" class="nav-pic-link" title="My Profile" id="navPicWrap">
          ${profilePicHtml(CURRENT_USER, 34)}
        </a>
        <span class="top-name nav-name">${CURRENT_USER.name.split(' ')[0]}</span>
      </div>
      <button class="btn btn-outline btn-sm nav-logout" id="logoutBtn">Log out</button>
    </div>
  `;

  document.body.prepend(topBar);
  document.body.prepend(nav);
  document.body.classList.add('with-sidebar');

  // Unread chat badge
  api('/chat/contacts').then(({ contacts }) => {
    const unread = contacts.reduce((n, c) => n + (c.unread || 0), 0);
    const badge = document.getElementById('navChatBadge');
    if (badge && unread > 0) { badge.textContent = unread; badge.style.display = 'inline-flex'; }
  }).catch(() => {});

  document.getElementById('logoutBtn').onclick = async () => {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  };

  document.getElementById('navBurger').onclick = () => {
    document.getElementById('navLinks').classList.toggle('open');
  };
}

/**
 * Global site footer showing administrator contact details.
 * Only used on the home and login pages — call it explicitly there.
 * Pulls the admin's name / email / phone / office from the API.
 */
async function renderFooter() {
  if (document.getElementById('siteFooter')) return;
  let contact = null;
  try { const r = await api('/contact'); contact = r.contact; } catch (_) {}

  const footer = document.createElement('footer');
  footer.id = 'siteFooter';
  footer.className = 'global-footer';
  const bits = [];
  if (contact) {
    if (contact.email) bits.push(`<span><i class="fa-solid fa-envelope"></i> <a href="mailto:${contact.email}">${contact.email}</a></span>`);
    if (contact.phone) bits.push(`<span><i class="fa-solid fa-phone"></i> ${contact.phone}</span>`);
    if (contact.office) bits.push(`<span><i class="fa-solid fa-location-dot"></i> ${contact.office}</span>`);
  }
  footer.innerHTML = `
    <div class="global-footer-inner">
      <div class="footer-brand">Campus Connect</div>
      <div class="footer-admin">
        <div class="footer-admin-label">Administrator${contact && contact.name ? ' · ' + contact.name : ''}</div>
        <div class="footer-admin-contacts">${bits.join('') || '<span>Contact details not set</span>'}</div>
      </div>
    </div>`;
  document.body.appendChild(footer);
}
