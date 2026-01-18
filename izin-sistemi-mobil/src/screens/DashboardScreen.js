import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

export default function DashboardScreen({ route, navigation }) {
  const { user, token } = route.params;
  const [aramaMetni, setAramaMetni] = useState('');

  // --- MENÜ YAPILANDIRMASI ---

  // 1. STANDART MENÜ (Herkesin göreceği menüler)
  const personelMenu = [
    {
      id: 1,
      baslik: 'İzin Talebi Oluştur',
      aciklama: 'Yıllık veya mazeret izni iste.',
      ikon: 'calendar', 
      renk: '#0d6efd', // Mavi
      hedef: 'IzinTalep' 
    },
    {
      id: 2,
      baslik: 'Geçmiş İzinlerim',
      aciklama: 'Eski taleplerini ve durumlarını gör.',
      ikon: 'folder-open', 
      renk: '#6610f2', // Mor
      hedef: 'GecmisIzinler' 
    },
    // ✅ YENİ EKLENEN DESTEK BUTONU
    {
      id: 4,
      baslik: 'Destek Merkezi',
      aciklama: 'Öneri, şikayet ve taleplerini ilet.',
      ikon: 'chatbubbles', 
      renk: '#0ea5e9', // Açık Mavi
      hedef: 'TalepYonetimi' 
    },
    {
      id: 3,
      baslik: 'Görevlerim',
      aciklama: 'Atanan sefer ve görevleri gör.',
      ikon: 'bus',
      renk: '#ffc107', // Sarı
      hedef: null // Henüz sayfası yok
    }
  ];

  // 2. YÖNETİCİ MENÜSÜ (Sadece Amir, Yazıcı, İK ve Admin görecek)
  const yoneticiMenu = [
    {
      id: 10,
      baslik: '🔴 Onay Bekleyenler',
      aciklama: 'İmzanızı bekleyen dosyalar.',
      ikon: 'create',
      renk: '#dc3545', // Kırmızı
      hedef: 'OnayListesi',
      params: { mod: 'BEKLEYEN' } 
    },
    {
      id: 11,
      baslik: '📂 Birim Geçmişi',
      aciklama: 'Biriminizdeki tüm işlemler.',
      ikon: 'file-tray-full',
      renk: '#198754', // Yeşil
      hedef: 'OnayListesi',
      params: { mod: 'GECMIS' }
    }
  ];

  // 3. MENÜLERİ BİRLEŞTİRME
  let aktifMenu = [...personelMenu];

  // Eğer kullanıcı yönetici ise, yönetici menüsünü en başa ekle
  if (['amir', 'yazici', 'ik', 'admin'].includes(user.rol)) {
    aktifMenu = [...yoneticiMenu, ...aktifMenu];
  }

  // 4. ARAMA FİLTRESİ
  const filtrelenmisMenu = aktifMenu.filter(item => 
    item.baslik.toLowerCase().includes(aramaMetni.toLowerCase())
  );

  // Çıkış Fonksiyonu
  const cikisYap = () => {
    navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      
      {/* --- ÜST HEADER --- */}
      <View style={styles.headerRow}>
        <View>
            <Text style={styles.welcomeLabel}>Hoşgeldin,</Text>
            <Text style={styles.nameText}>{user.ad} {user.soyad}</Text>
            <Text style={styles.roleText}>{user.rol.toUpperCase()}</Text>
        </View>

        {/* SAĞ ÜST BUTONLAR */}
        <View style={{flexDirection:'row'}}>
            {/* BİLDİRİM */}
            <TouchableOpacity 
                style={[styles.iconButton, {marginRight: 10, backgroundColor: '#ffc107'}]}
                onPress={() => navigation.navigate('Bildirimler', { user, token })}
            >
                <Ionicons name="notifications" size={24} color="#fff" />
            </TouchableOpacity>

            {/* PROFİL */}
            <TouchableOpacity 
                style={[styles.iconButton, {backgroundColor: '#0d6efd'}]}
                onPress={() => navigation.navigate('Profil', { user, token })}
            >
                <Ionicons name="person" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
      </View>

      {/* --- ARAMA ÇUBUĞU --- */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
            style={styles.searchInput}
            placeholder="Menüde ara..."
            value={aramaMetni}
            onChangeText={setAramaMetni}
        />
      </View>

      {/* --- MENÜ LİSTESİ --- */}
      <ScrollView style={styles.menuContainer} contentContainerStyle={{ paddingBottom: 20 }}>
        
        {filtrelenmisMenu.map((item) => (
            <TouchableOpacity 
                key={item.id}
                style={styles.card}
                onPress={() => {
                    if(item.hedef) {
                        navigation.navigate(item.hedef, { user, token, ...item.params });
                    } else {
                        Alert.alert("Yakında", "Bu özellik yapım aşamasında.");
                    }
                }}
            >
                {/* İkon Kutusu */}
                <View style={[styles.iconBox, { backgroundColor: item.renk }]}>
                    <Ionicons name={item.ikon} size={24} color="white" />
                </View>

                {/* Yazılar */}
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.baslik}</Text>
                    <Text style={styles.cardDesc}>{item.aciklama}</Text>
                </View>

                {/* Ok İşareti */}
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
        ))}

        {filtrelenmisMenu.length === 0 && (
            <Text style={styles.noResult}>Aradığınız özellik bulunamadı.</Text>
        )}

        {/* Çıkış Butonu */}
        <TouchableOpacity style={styles.logoutButton} onPress={cikisYap}>
            <Ionicons name="log-out-outline" size={20} color="white" style={{marginRight: 10}} />
            <Text style={styles.logoutText}>Güvenli Çıkış Yap</Text>
        </TouchableOpacity>

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20, paddingTop: 50 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  welcomeLabel: { fontSize: 14, color: '#666' },
  nameText: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  roleText: { fontSize: 12, color: '#0d6efd', fontWeight: 'bold' },
  
  iconButton: { 
      width: 45, height: 45, borderRadius: 25, 
      justifyContent: 'center', alignItems: 'center', elevation: 5 
  },

  searchContainer: { 
      flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', 
      borderRadius: 10, paddingHorizontal: 15, height: 50, marginBottom: 20, elevation: 2 
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16 },

  menuContainer: { flex: 1 },
  card: {
    backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15,
    elevation: 2, flexDirection: 'row', alignItems: 'center'
  },
  iconBox: { 
      width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cardDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  noResult: { textAlign: 'center', color: '#999', marginTop: 20 },

  logoutButton: { 
      backgroundColor: '#dc3545', padding: 15, borderRadius: 15, marginTop: 10,
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 2
  },
  logoutText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});