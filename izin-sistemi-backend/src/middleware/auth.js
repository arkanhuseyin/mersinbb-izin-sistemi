const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        // 1. Header'dan Authorization bilgisini al
        const authHeader = req.header('Authorization');

        // 2. Header yoksa reddet
        if (!authHeader) {
            return res.status(401).json({ mesaj: 'Erişim reddedildi. Token bulunamadı.' });
        }

        // 3. Token Temizliği (REGEX ile Profesyonel Temizlik)
        // - "Bearer " kelimesini sil (Büyük/küçük harf duyarsız)
        // - Tırnak işaretlerini (") sil (Mobilden gelen hataları önler)
        // - Başta ve sondaki boşlukları temizle
        const token = authHeader.replace(/^Bearer\s+/i, '').replace(/"/g, '').trim();

        if (!token) {
            return res.status(401).json({ mesaj: 'Token formatı hatalı.' });
        }

        // 4. Doğrulama
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 5. Kullanıcıyı isteğe ekle
        req.user = decoded; 
        next(); 

    } catch (err) {
        console.error("Auth Hatası:", err.message);
        res.status(401).json({ mesaj: 'Oturum süresi dolmuş veya geçersiz token.' });
    }
};