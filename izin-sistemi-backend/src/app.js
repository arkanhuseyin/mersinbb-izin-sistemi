const express = require("express");
const cors = require("cors");
const path = require('path');
const fs = require('fs');

// --- ROTA DOSYALARI ---
const authRoutes = require("./src/routes/authRoutes");
const personelRoutes = require("./src/routes/personelRoutes");
const izinRoutes = require("./src/routes/izinRoutes");
const ayarRoutes = require("./src/routes/ayarRoutes");
const yetkiRoutes = require("./src/routes/yetkiRoutes");
const talepRoutes = require("./src/routes/talepRoutes"); // ✅ Talep Rotası

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik Dosyalar (Uploads)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// --- ROTALARI KULLAN ---
app.use("/api/auth", authRoutes);
app.use("/api/personel", personelRoutes);
app.use("/api/izin", izinRoutes);
app.use("/api/ayar", ayarRoutes);
app.use("/api/yetki", yetkiRoutes);
app.use("/api/talep", talepRoutes); // ✅ Backend API Rotası

// Test Rotası
app.get('/', (req, res) => {
    res.send('API Çalışıyor...');
});

module.exports = app;