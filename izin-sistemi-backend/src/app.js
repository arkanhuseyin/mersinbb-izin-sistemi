const express = require("express");
const cors = require("cors");

// --- ROTA DOSYALARINI İMPORT ET ---
const authRoutes = require("./routes/authRoutes");
const personelRoutes = require("./routes/personelRoutes");
const izinRoutes = require("./routes/izinRoutes");
const ayarRoutes = require("./routes/ayarRoutes");    // ✅ Yeni eklediğimiz
const yetkiRoutes = require("./routes/yetkiRoutes");  // ✅ Yetkilendirme

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// Statik dosyalar (Uploads klasörü vb. varsa buraya eklenir)
app.use('/uploads', express.static('uploads'));

// --- ROTALARI KULLAN ---
app.use("/api/auth", authRoutes);
app.use("/api/personel", personelRoutes);
app.use("/api/izin", izinRoutes);
app.use("/api/ayar", ayarRoutes);    // ✅ Ayarlar sayfası (Hakediş ekleme) için şart
app.use("/api/yetki", yetkiRoutes);  // ✅ Yetkiler sayfası için şart

module.exports = app;