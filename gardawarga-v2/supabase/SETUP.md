# GardaWarga + Supabase

1. Buat project Supabase baru.

2. Buka SQL Editor dan jalankan seluruh isi:
supabase/schema.sql

3. Buka supabase-config.js lalu isi:
GARDAWARGA_SUPABASE_URL = Project URL
GARDAWARGA_SUPABASE_KEY = Publishable key

Gunakan Publishable key untuk website browser. Jangan memasukkan Secret atau Service Role key ke frontend.

4. Buat akun petugas di Authentication > Users:
Email: 24@gmail.com
Password: gunakan password petugas yang kamu tentukan sendiri.

Trigger database akan membuat profile dan memberi role petugas berdasarkan email tersebut.

5. Jika email confirmation aktif, warga perlu konfirmasi email sebelum login. Untuk testing, sesuaikan pengaturan Auth project.

6. Setelah konfigurasi selesai, website dapat dijalankan di GitHub Pages. Supabase menjadi backend online untuk Auth, Database, dan Storage.

Fitur yang sudah disiapkan:
- Login/logout Supabase Auth
- Registrasi warga
- Profile warga
- Role warga/petugas
- Pengaduan online dan status
- Dashboard
- Notifikasi
- Forum, like, pin, dan moderasi topik
- Jadwal database
- Tambah/hapus jadwal oleh petugas
- Storage foto pengaduan

Keamanan: RLS sudah dipasang. Jangan menggunakan Secret/Service Role key di JavaScript frontend.