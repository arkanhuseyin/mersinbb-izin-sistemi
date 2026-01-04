import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '../config'; 

export default function AyarlarScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sifre'); // 'sifre' veya 'bilgi'

  // Şifre State'leri
  const [eskiSifre, setEskiSifre] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');

  // Bilgi Güncelleme State'leri
  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [adres, setAdres] = useState('');
  const [srcTarih, setSrcTarih] = useState('');
  const [psikoTarih, setPsikoTarih] = useState('');
  
  const [files, setFiles] = useState({ adres: null, src: null, psiko: null });

  // Belge Seçici
  const pickDoc = async (tur) => {
    try {
        let result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
        if (!result.canceled && result.assets) {
            setFiles({ ...files, [tur]: result.assets[0] });
            Alert.alert("Tamam", "Dosya seçildi.");
        }
    } catch (e) { Alert.alert("Hata", "Dosya seçilemedi."); }
  };

  // 1. ŞİFRE DEĞİŞTİRME İŞLEMİ
  const handleSifreDegistir = async () => {
      if(!eskiSifre || !yeniSifre || !yeniSifreTekrar) return Alert.alert("Uyarı", "Tüm alanları doldurun.");
      if(yeniSifre !== yeniSifreTekrar) return Alert.alert("Hata", "Yeni şifreler uyuşmuyor.");
      
      setLoading(true);
      try {
          const token = await AsyncStorage.getItem('userToken');
          await axios.post(`${API_URL}/api/personel/sifre-degistir`, 
            { eski_sifre: eskiSifre, yeni_sifre: yeniSifre }, 
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          Alert.alert("Başarılı", "Şifreniz değiştirildi.");
          setEskiSifre(''); setYeniSifre(''); setYeniSifreTekrar('');
      } catch (error) {
          Alert.alert("Hata", error.response?.data?.mesaj || "İşlem başarısız.");
      } finally { setLoading(false); }
  };

  // 2. BİLGİ GÜNCELLEME TALEBİ
  const handleTalepGonder = async () => {
      // Basit kontrol: En az bir şey değişmeli
      if(!telefon && !email && !adres && !srcTarih && !psikoTarih) {
          return Alert.alert("Uyarı", "En az bir bilgi girmelisiniz.");
      }
      
      // Zorunluluk Kontrolü: Adres varsa Belge Şart
      if(adres && !files.adres) return Alert.alert("Uyarı", "Adres değişikliği için İkametgah belgesi yüklemelisiniz.");
      if(srcTarih && !files.src) return Alert.alert("Uyarı", "SRC tarihi için belge yüklemelisiniz.");
      if(psikoTarih && !files.psiko) return Alert.alert("Uyarı", "Psikoteknik tarihi için belge yüklemelisiniz.");

      setLoading(true);
      try {
          const token = await AsyncStorage.getItem('userToken');
          const formData = new FormData();
          
          if(telefon) formData.append('telefon', telefon);
          if(email) formData.append('email', email);
          if(adres) formData.append('adres', adres);
          if(srcTarih) formData.append('src_tarih', srcTarih);
          if(psikoTarih) formData.append('psiko_tarih', psikoTarih);

          // Dosyalar
          if(files.adres) formData.append('adres_belgesi', { uri: files.adres.uri, name: 'ikametgah.pdf', type: files.adres.mimeType || 'application/pdf' });
          if(files.src) formData.append('src_belgesi', { uri: files.src.uri, name: 'src.pdf', type: files.src.mimeType || 'application/pdf' });
          if(files.psiko) formData.append('psiko_belgesi', { uri: files.psiko.uri, name: 'psiko.pdf', type: files.psiko.mimeType || 'application/pdf' });

          await axios.post(`${API_URL}/api/personel/guncelle-talep`, formData, {
              headers: { 
                  'Authorization': `Bearer ${token}`, 
                  'Content-Type': 'multipart/form-data',
                  'bypass-tunnel-reminder': 'true'
              }
          });

          Alert.alert("Başarılı", "Talebiniz yönetici onayına gönderildi.");
          navigation.goBack();
      } catch (error) {
          Alert.alert("Hata", "Talep gönderilemedi.");
      } finally { setLoading(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#cc0000" /></View>;

  return (
    <View style={styles.container}>
      {/* ÜST TAB MENÜ */}
      <View style={styles.tabContainer}>
          <TouchableOpacity onPress={()=>setActiveTab('sifre')} style={[styles.tabBtn, activeTab==='sifre' && styles.activeTab]}>
              <Ionicons name="key-outline" size={20} color={activeTab==='sifre'?'#cc0000':'#666'} />
              <Text style={[styles.tabText, activeTab==='sifre' && styles.activeTabText]}>Şifre Değiştir</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setActiveTab('bilgi')} style={[styles.tabBtn, activeTab==='bilgi' && styles.activeTab]}>
              <Ionicons name="create-outline" size={20} color={activeTab==='bilgi'?'#cc0000':'#666'} />
              <Text style={[styles.tabText, activeTab==='bilgi' && styles.activeTabText]}>Bilgi Güncelle</Text>
          </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* --- TAB 1: ŞİFRE DEĞİŞTİRME --- */}
        {activeTab === 'sifre' && (
            <View style={styles.card}>
                <Text style={styles.header}>🔒 Güvenlik</Text>
                <Text style={styles.subHeader}>Şifrenizi güncellemek için eski şifrenizi doğrulayın.</Text>
                
                <Text style={styles.label}>Mevcut Şifre</Text>
                <TextInput style={styles.input} value={eskiSifre} onChangeText={setEskiSifre} secureTextEntry placeholder="******" />
                
                <Text style={styles.label}>Yeni Şifre</Text>
                <TextInput style={styles.input} value={yeniSifre} onChangeText={setYeniSifre} secureTextEntry placeholder="******" />
                
                <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
                <TextInput style={styles.input} value={yeniSifreTekrar} onChangeText={setYeniSifreTekrar} secureTextEntry placeholder="******" />

                <TouchableOpacity style={styles.saveBtn} onPress={handleSifreDegistir}>
                    <Text style={styles.saveBtnText}>Şifreyi Güncelle</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* --- TAB 2: BİLGİ GÜNCELLEME --- */}
        {activeTab === 'bilgi' && (
            <View>
                {/* İletişim */}
                <View style={styles.card}>
                    <Text style={styles.header}>📞 İletişim Bilgileri</Text>
                    <Text style={styles.subHeader}>Değişiklik yapmak istediğiniz alanları doldurun.</Text>

                    <Text style={styles.label}>Telefon Numarası</Text>
                    <TextInput style={styles.input} value={telefon} onChangeText={setTelefon} placeholder="05XX..." keyboardType="phone-pad" />

                    <Text style={styles.label}>E-Posta Adresi</Text>
                    <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="ornek@email.com" keyboardType="email-address" autoCapitalize="none" />

                    <Text style={styles.label}>Adres</Text>
                    <TextInput style={[styles.input, {height:60}]} value={adres} onChangeText={setAdres} multiline placeholder="Yeni adresiniz..." />
                    
                    {adres.length > 0 && (
                        <TouchableOpacity style={[styles.fileBtn, files.adres && styles.fileBtnSuccess]} onPress={()=>pickDoc('adres')}>
                            <Ionicons name="document-attach-outline" size={20} color="white" />
                            <Text style={styles.fileBtnText}>{files.adres ? "İkametgah Seçildi" : "İkametgah Yükle (Zorunlu)"}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Belgeler */}
                <View style={styles.card}>
                    <Text style={styles.header}>📄 Belge Geçerlilik Tarihleri</Text>
                    
                    <Text style={styles.label}>SRC Geçerlilik Tarihi</Text>
                    <TextInput style={styles.input} value={srcTarih} onChangeText={setSrcTarih} placeholder="YYYY-AA-GG" />
                    {srcTarih.length > 0 && (
                        <TouchableOpacity style={[styles.fileBtn, files.src && styles.fileBtnSuccess]} onPress={()=>pickDoc('src')}>
                            <Ionicons name="document-attach-outline" size={20} color="white" />
                            <Text style={styles.fileBtnText}>{files.src ? "SRC Belgesi Seçildi" : "SRC Belgesi Yükle (Zorunlu)"}</Text>
                        </TouchableOpacity>
                    )}

                    <Text style={styles.label}>Psikoteknik Geçerlilik Tarihi</Text>
                    <TextInput style={styles.input} value={psikoTarih} onChangeText={setPsikoTarih} placeholder="YYYY-AA-GG" />
                    {psikoTarih.length > 0 && (
                        <TouchableOpacity style={[styles.fileBtn, files.psiko && styles.fileBtnSuccess]} onPress={()=>pickDoc('psiko')}>
                            <Ionicons name="document-attach-outline" size={20} color="white" />
                            <Text style={styles.fileBtnText}>{files.psiko ? "Psiko. Seçildi" : "Psikoteknik Yükle (Zorunlu)"}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleTalepGonder}>
                    <Text style={styles.saveBtnText}>Değişiklik Talebi Gönder</Text>
                </TouchableOpacity>
                <View style={{height:30}}/>
            </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', elevation: 3 },
  tabBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#cc0000' },
  tabText: { marginLeft: 8, fontWeight: 'bold', color: '#666' },
  activeTabText: { color: '#cc0000' },
  content: { padding: 15 },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 15, marginBottom: 15, elevation: 2 },
  header: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subHeader: { fontSize: 12, color: '#888', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fafafa' },
  saveBtn: { backgroundColor: '#cc0000', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  fileBtn: { flexDirection: 'row', backgroundColor: '#666', padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  fileBtnSuccess: { backgroundColor: '#28a745' },
  fileBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 13 }
});