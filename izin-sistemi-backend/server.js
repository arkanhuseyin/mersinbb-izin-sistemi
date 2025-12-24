const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs'); // <--- 1. EKLEME: Dosya sistemi modülü

// 1. ADIM: Ayarları EN BAŞTA yükle
dotenv.config(); 

// 2. ADIM: Ayarlar yüklendikten sonra veritabanını çağır
const pool = require('./src/config/db');

// --- ROTA DOSYALARI ---
const authRoutes = require('./src/routes/authRoutes');
const izinRoutes = require('./src/routes/izinRoutes');
const personelRoutes = require('./src/routes/personelRoutes');
const yetkiRoutes = require('./src/routes/yetkiRoutes');

const app = express();

// --- MIDDLEWARE (Ara Katmanlar) ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 2. EKLEME: Uploads Klasörü Kontrolü ve Dışa Açma ---
// Klasör yolunu belirle
const uploadsDir = path.join(__dirname, 'uploads');

// Klasör yoksa oluştur (Render'da hata almamak için şart)
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📂 Uploads klasörü oluşturuldu.');
}

// Klasörü statik olarak dışarı aç
// Artık https://site-adi.com/uploads/resim.jpg diye erişilebilir.
app.use('/uploads', express.static(uploadsDir));

// --- ROTALAR ---
app.use('/api/auth', authRoutes);       
app.use('/api/izin', izinRoutes);       
app.use('/api/personel', personelRoutes); 
app.use('/api/yetki', yetkiRoutes);  

// Test Rotası
app.get('/', (req, res) => {
    res.send('Mersin BB İzin & Görev Sistemi API Çalışıyor! 🚀 (Veritabanı Bağlantısı: Aktif)');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda çalışıyor...`);
});