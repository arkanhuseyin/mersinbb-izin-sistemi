const express = require('express');
const router = express.Router();
const ayarController = require('../controllers/ayarController');
const auth = require('../middleware/auth'); 

router.get('/hakedis-listele', auth, ayarController.getHakedisKurallari);
router.post('/hakedis-ekle', auth, ayarController.addHakedisKurali);
router.delete('/hakedis-sil/:id', auth, ayarController.deleteHakedisKurali);

module.exports = router;