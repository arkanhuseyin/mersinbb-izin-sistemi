const express = require('express');
const router = express.Router();
const talepController = require('../controllers/talepController');
const auth = require('../middleware/auth');

// 1. Talepleri Listele (Personel ise kendisininkini, Yetkili ise hepsini)
router.get('/listele', auth, talepController.talepleriGetir);

// 2. Yeni Talep Oluştur
router.post('/olustur', auth, talepController.talepOlustur);

// 3. Talep Detayını ve Mesajları Getir
router.get('/detay/:id', auth, talepController.talepDetay);

// 4. Cevap Yaz veya Durum Güncelle
router.post('/cevapla', auth, talepController.cevapYaz);

module.exports = router;