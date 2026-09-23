/* GardaWarga v2 - Client-side logic (localStorage simulation) */

const App = {
  // ===== AUTH =====
  staffAccount: {
    nama: 'Petugas GardaWarga',
    email: '24@gmail.com',
    password: '24sahabat',
    role: 'petugas',
    rt: '-',
    rw: '-',
    hp: '-'
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem('gw_user')); } catch { return null; }
  },
  setUser(user) {
    localStorage.setItem('gw_user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('gw_user');
    window.location.href = 'index.html';
  },
  isLoggedIn() {
    return !!this.getUser();
  },
  getAccounts() {
    const defaultAccounts = [{
      nama: 'Fathir Wildan',
      email: 'warga@gardawarga.id',
      password: '123456',
      role: 'warga',
      rt: '03',
      rw: '01',
      hp: '081234567890'
    }];
    try {
      const stored = localStorage.getItem('gw_accounts');
      return stored ? JSON.parse(stored) : defaultAccounts;
    } catch { return defaultAccounts; }
  },
  saveAccounts(accounts) {
    localStorage.setItem('gw_accounts', JSON.stringify(accounts));
  },
  login(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const account = normalizedEmail === this.staffAccount.email
      ? this.staffAccount
      : this.getAccounts().find(item => item.email.toLowerCase() === normalizedEmail);
    if (!account || account.password !== password) return false;

    const { password: unusedPassword, ...sessionUser } = account;
    this.setUser(sessionUser);
    return true;
  },
  registerAccount(account) {
    const email = account.email.trim().toLowerCase();
    if (email === this.staffAccount.email || this.getAccounts().some(item => item.email.toLowerCase() === email)) {
      return false;
    }
    const accounts = this.getAccounts();
    const newAccount = { ...account, email, role: 'warga' };
    accounts.push(newAccount);
    this.saveAccounts(accounts);
    const { password: unusedPassword, ...sessionUser } = newAccount;
    this.setUser(sessionUser);
    return true;
  },
  isStaff(user = this.getUser()) {
    return user?.role === 'petugas' && user.email === this.staffAccount.email;
  },
  getVisiblePengaduan(user = this.getUser()) {
    const list = this.getPengaduan();
    if (this.isStaff(user)) return list;
    return list.filter(item => item.email === user?.email);
  },

  // ===== NOTIFICATIONS =====
  getNotifs() {
    const defaultNotifs = [
      { id: 1, text: 'Jadwal kerja bakti berubah menjadi Sabtu 20 Sept', time: '2 jam lalu', read: false },
      { id: 2, text: 'Rapat RT besok pukul 19.00 di Balai Warga', time: '5 jam lalu', read: false },
      { id: 3, text: 'Pengumuman: pembayaran iuran bulan September', time: '1 hari lalu', read: false },
      { id: 4, text: 'Pengaduan lampu jalan Anda sedang diproses', time: '2 hari lalu', read: true }
    ];
    try {
      const stored = localStorage.getItem('gw_notifs');
      return stored ? JSON.parse(stored) : defaultNotifs;
    } catch { return defaultNotifs; }
  },
  saveNotifs(list) {
    localStorage.setItem('gw_notifs', JSON.stringify(list));
  },
  unreadCount() {
    return this.getNotifs().filter(n => !n.read).length;
  },
  markAllRead() {
    const list = this.getNotifs().map(n => ({ ...n, read: true }));
    this.saveNotifs(list);
  },

  // ===== PENGADUAN =====
  getPengaduan() {
    try {
      return JSON.parse(localStorage.getItem('gw_pengaduan') || '[]');
    } catch { return []; }
  },
  addPengaduan(data) {
    const list = this.getPengaduan();
    list.unshift({
      id: Date.now(),
      ...data,
      email: this.getUser()?.email,
      tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Dikirim'
    });
    localStorage.setItem('gw_pengaduan', JSON.stringify(list));
  },
  updatePengaduanStatus(id, status, user = this.getUser()) {
    const allowedStatuses = ['Diterima', 'Diproses', 'Selesai'];
    if (!this.isStaff(user) || !allowedStatuses.includes(status)) return false;

    const list = this.getPengaduan();
    const aduan = list.find(item => item.id === id);
    if (!aduan) return false;
    aduan.status = status;
    localStorage.setItem('gw_pengaduan', JSON.stringify(list));
    return true;
  },

  // ===== FORUM LIKES =====
  toggleLike(id) {
    const key = 'gw_likes';
    let likes = {};
    try { likes = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    likes[id] = !likes[id];
    localStorage.setItem(key, JSON.stringify(likes));
    return likes[id];
  },
  isLiked(id) {
    try {
      const likes = JSON.parse(localStorage.getItem('gw_likes') || '{}');
      return !!likes[id];
    } catch { return false; }
  },

  // ===== RENDER NAV =====
  renderNav() {
    const user = this.getUser();
    const notifCount = this.unreadCount();
    const navRight = document.getElementById('navRight');
    if (!navRight) return;

    if (user) {
      navRight.innerHTML = `
        <div style="position:relative">
          <button class="notif-btn" id="notifBtn" title="Notifikasi">
            <i class="fas fa-bell"></i>
            ${notifCount > 0 ? `<span class="notif-badge">${notifCount}</span>` : ''}
          </button>
          <div class="notif-dropdown" id="notifDropdown">
            <div class="notif-header">
              <span>Notifikasi</span>
              <a href="#" id="markRead" style="font-size:0.8rem;color:var(--primary)">Tandai dibaca</a>
            </div>
            ${this.getNotifs().map(n => `
              <div class="notif-item ${n.read ? '' : 'unread'}">
                <p>${n.text}</p>
                <small>${n.time}</small>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="user-menu">
          <button class="user-btn" id="userBtn">
            <span class="user-avatar">${user.nama.charAt(0).toUpperCase()}</span>
            ${user.nama.split(' ')[0]}
            <i class="fas fa-chevron-down" style="font-size:0.7rem"></i>
          </button>
          <div class="user-dropdown" id="userDropdown">
            <a href="dashboard.html"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
            <a href="profil-saya.html"><i class="fas fa-user"></i> Profil Saya</a>
            <a href="pengaduan.html"><i class="fas fa-exclamation-triangle"></i> Pengaduan Saya</a>
            <a href="#" class="logout" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</a>
          </div>
        </div>
      `;

      // Events
      document.getElementById('notifBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('notifDropdown')?.classList.toggle('show');
        document.getElementById('userDropdown')?.classList.remove('show');
      });
      document.getElementById('userBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('userDropdown')?.classList.toggle('show');
        document.getElementById('notifDropdown')?.classList.remove('show');
      });
      document.getElementById('markRead')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.markAllRead();
        this.renderNav();
      });
      document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    } else {
      navRight.innerHTML = `
        <a href="login.html" class="btn-auth btn-login">Login</a>
        <a href="register.html" class="btn-auth btn-register">Daftar</a>
      `;
    }

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      document.getElementById('notifDropdown')?.classList.remove('show');
      document.getElementById('userDropdown')?.classList.remove('show');
    });
  },

  // Mobile toggle
  initMobileNav() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('open'));
    }
  },

  init() {
    this.renderNav();
    this.initMobileNav();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
