const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader) {
            return res.status(401).json({ mesaj: 'Erişim reddedildi. Token yok.' });
        }

        // 🛠️ KRİTİK GÜNCELLEME:
        // Hem "Bearer " kelimesini, hem de tırnak işaretlerini (") temizliyoruz.
        const token = authHeader.replace(/^Bearer\s+/i, '').replace(/"/g, '').trim();

        if (!token) {
            return res.status(401).json({ mesaj: 'Token formatı hatalı.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();

    } catch (err) {
        console.error("Auth Hatası:", err.message);
        return res.status(401).json({ mesaj: 'Oturum süresi dolmuş.' });
    }
};