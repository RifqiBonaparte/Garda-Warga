/* GardaWarga - Supabase client */
const App = {
  supabase: null,
  user: null,
  profile: null,
  ready: null,

  initSupabase() {
    if (this.supabase) return this.supabase;
    const url = window.GARDAWARGA_SUPABASE_URL;
    const key = window.GARDAWARGA_SUPABASE_KEY;
    if (!url || !key || url.includes('PASTE_') || key.includes('PASTE_')) {
      console.warn('Supabase belum dikonfigurasi. Isi supabase-config.js terlebih dahulu.');
      return null;
    }
    if (!window.supabase?.createClient) {
      console.error('Supabase JS belum dimuat.');
      return null;
    }
    this.supabase = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return this.supabase;
  },

  async loadUser() {
    const sb = this.initSupabase();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser();
    if (error || !data.user) {
      this.user = null;
      this.profile = null;
      return null;
    }
    this.user = data.user;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    this.profile = profile || null;
    return data.user;
  },

  async init() {
    this.initSupabase();
    if (this.supabase) {
      this.ready = this.loadUser();
      await this.ready;
      this.supabase.auth.onAuthStateChange(() => {
        setTimeout(() => this.loadUser().then(() => this.renderNav()), 0);
      });
    } else {
      this.ready = Promise.resolve(null);
    }
    this.renderNav();
    this.initMobileNav();
  },

  async wait() {
    if (!this.ready) await this.init();
    else await this.ready;
    return this.user;
  },

  getUser() {
    return this.profile || (this.user ? {
      id: this.user.id,
      email: this.user.email,
      nama: this.user.user_metadata?.nama || this.user.email?.split('@')[0] || 'Warga',
      role: this.user.user_metadata?.role || 'warga'
    } : null);
  },

  isLoggedIn() { return !!this.user; },

  isStaff(user = this.getUser()) {
    return user?.role === 'petugas' || user?.email?.toLowerCase() === '24@gmail.com';
  },

  async login(email, password) {
    const sb = this.initSupabase();
    if (!sb) throw new Error('Supabase belum dikonfigurasi.');
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) throw error;
    this.user = data.user;
    await this.loadUser();
    return true;
  },

  async registerAccount(account) {
    const sb = this.initSupabase();
    if (!sb) throw new Error('Supabase belum dikonfigurasi.');
    const email = account.email.trim().toLowerCase();
    const { data, error } = await sb.auth.signUp({
      email,
      password: account.password,
      options: {
        data: {
          nama: account.nama,
          hp: account.hp || '-',
          rt: account.rt || '-',
          rw: account.rw || '-',
          role: 'warga'
        }
      }
    });
    if (error) throw error;
    if (data.user && data.session) {
      this.user = data.user;
      await this.loadUser();
    }
    return { user: data.user, session: data.session };
  },

  async logout() {
    const sb = this.initSupabase();
    if (sb) await sb.auth.signOut();
    this.user = null;
    this.profile = null;
    window.location.href = 'index.html';
  },

  async getNotifs() {
    const sb = this.initSupabase();
    if (!sb || !this.user) return [];
    const { data, error } = await sb.from('notifikasi')
      .select('*')
      .or('target_user_id.is.null,target_user_id.eq.' + this.user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  },

  async unreadCount() {
    const list = await this.getNotifs();
    return list.filter(n => !n.read_at).length;
  },

  async markAllRead() {
    const sb = this.initSupabase();
    if (!sb || !this.user) return;
    await sb.from('notifikasi')
      .update({ read_at: new Date().toISOString() })
      .eq('target_user_id', this.user.id)
      .is('read_at', null);
  },

  async getPengaduan(user = this.getUser()) {
    const sb = this.initSupabase();
    if (!sb || !this.user) return [];
    let query = sb.from('pengaduan').select('*').order('created_at', { ascending: false });
    if (!this.isStaff(user)) query = query.eq('user_id', this.user.id);
    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return data || [];
  },

  async addPengaduan(data) {
    const sb = this.initSupabase();
    if (!sb || !this.user) throw new Error('Belum login.');
    const payload = {
      user_id: this.user.id,
      nama: this.profile?.nama || this.user.user_metadata?.nama || data.nama,
      email: this.user.email,
      kategori: data.kategori,
      judul: data.judul || data.kategori,
      lokasi: data.lokasi,
      deskripsi: data.deskripsi,
      foto_url: data.foto_url || null,
      foto_nama: data.foto_nama || null,
      status: 'Dikirim'
    };
    const { error } = await sb.from('pengaduan').insert(payload);
    if (error) throw error;
    return true;
  },

  async updatePengaduanStatus(id, status) {
    const sb = this.initSupabase();
    if (!sb || !this.isStaff()) return false;
    const { error } = await sb.from('pengaduan')
      .update({ status, diproses_oleh: this.user.id })
      .eq('id', id);
    if (error) { console.error(error); return false; }
    return true;
  },

  async getJadwal() {
    const sb = this.initSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('jadwal').select('*').order('tanggal').order('created_at');
    if (error) { console.error(error); return []; }
    return data || [];
  },

  async saveJadwal(data, id = null) {
    const sb = this.initSupabase();
    if (!sb || !this.isStaff()) throw new Error('Akses petugas diperlukan.');
    if (id) {
      const { error } = await sb.from('jadwal').update(data).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('jadwal').insert({ ...data, created_by: this.user.id });
      if (error) throw error;
    }
  },

  async deleteJadwal(id) {
    const sb = this.initSupabase();
    if (!sb || !this.isStaff()) return;
    const { error } = await sb.from('jadwal').delete().eq('id', id);
    if (error) throw error;
  },

  async getForum() {
    const sb = this.initSupabase();
    if (!sb) return [];
    const { data, error } = await sb.from('forum_topik')
      .select('*, profiles!forum_topik_user_id_fkey(nama), forum_komentar(count), forum_like(count)')
      .is('deleted_at', null)
      .order('dipin', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      const fallback = await sb.from('forum_topik').select('*').is('deleted_at', null)
        .order('dipin', { ascending: false }).order('created_at', { ascending: false });
      return fallback.data || [];
    }
    return data || [];
  },

  async addForumTopik(judul, isi) {
    const sb = this.initSupabase();
    if (!sb || !this.user) throw new Error('Belum login.');
    const { error } = await sb.from('forum_topik').insert({
      user_id: this.user.id, judul, isi
    });
    if (error) throw error;
  },

  async addForumKomentar(topikId, isi) {
    const sb = this.initSupabase();
    if (!sb || !this.user) throw new Error('Belum login.');
    const { error } = await sb.from('forum_komentar').insert({
      topik_id: topikId, user_id: this.user.id, isi
    });
    if (error) throw error;
  },

  async toggleLike(topikId) {
    const sb = this.initSupabase();
    if (!sb || !this.user) throw new Error('Belum login.');
    const { data: existing } = await sb.from('forum_like').select('id')
      .eq('topik_id', topikId).eq('user_id', this.user.id).maybeSingle();
    if (existing) {
      await sb.from('forum_like').delete().eq('id', existing.id);
      return false;
    }
    const { error } = await sb.from('forum_like').insert({ topik_id: topikId, user_id: this.user.id });
    if (error) throw error;
    return true;
  },

  async deleteForumTopik(id) {
    const sb = this.initSupabase();
    if (!sb || !this.isStaff()) return;
    const { error } = await sb.from('forum_topik')
      .update({ deleted_at: new Date().toISOString(), deleted_by: this.user.id }).eq('id', id);
    if (error) throw error;
  },

  async pinForumTopik(id, pinned) {
    const sb = this.initSupabase();
    if (!sb || !this.isStaff()) return;
    const { error } = await sb.from('forum_topik').update({ dipin: pinned }).eq('id', id);
    if (error) throw error;
  },

  renderNav() {
    const navRight = document.getElementById('navRight');
    if (!navRight) return;
    const user = this.getUser();
    if (!user) {
      navRight.innerHTML = '<a href="login.html" class="btn-auth btn-login">Login</a><a href="register.html" class="btn-auth btn-register">Daftar</a>';
      return;
    }
    navRight.innerHTML = '<div class="user-menu"><button class="user-btn" id="userBtn"><span class="user-avatar">' +
      (user.nama || 'W').charAt(0).toUpperCase() + '</span>' +
      (user.nama || 'Warga').split(' ')[0] +
      ' <i class="fas fa-chevron-down" style="font-size:0.7rem"></i></button>' +
      '<div class="user-dropdown" id="userDropdown">' +
      '<a href="dashboard.html"><i class="fas fa-tachometer-alt"></i> Dashboard</a>' +
      '<a href="profil-saya.html"><i class="fas fa-user"></i> Profil Saya</a>' +
      '<a href="pengaduan.html"><i class="fas fa-exclamation-triangle"></i> Pengaduan Saya</a>' +
      (this.isStaff(user) ? '<a href="jadwal.html"><i class="fas fa-calendar"></i> Kelola Jadwal</a>' : '') +
      '<a href="#" class="logout" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</a></div></div>';
    document.getElementById('userBtn')?.addEventListener('click', e => {
      e.stopPropagation(); document.getElementById('userDropdown')?.classList.toggle('show');
    });
    document.getElementById('logoutBtn')?.addEventListener('click', e => {
      e.preventDefault(); this.logout();
    });
  },

  initMobileNav() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (toggle && links) toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
