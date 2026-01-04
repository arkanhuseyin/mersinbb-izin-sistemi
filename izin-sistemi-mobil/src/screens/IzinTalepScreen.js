import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../config';

export default function IzinTalepScreen({ route, navigation }) {
  const { user, token } = route.params;

  const [baslangicTarihi, setBaslangicTarihi] = useState(new Date());
  const [gunSayisi, setGunSayisi] = useState('1');
  const [haftalikIzin, setHaftalikIzin] = useState('Pazar');
  const [izinTuru, setIzinTuru] = useState('YILLIK İZİN');
  const [aciklama, setAciklama] = useState('');
  
  const [adresSecimi, setAdresSecimi] = useState('MEVCUT');
  const [izinAdresi, setIzinAdresi] = useState(user.adres || '');
  const [imza, setImza] = useState(null);
  const [imzaModalAcik, setImzaModalAcik] = useState(false);
  const [raporDosyasi, setRaporDosyasi] = useState(null);
  
  const [bitisTarihi, setBitisTarihi] = useState('');
  const [iseBaslama, setIseBaslama] = useState('');
  const [resmiTatiller, setResmiTatiller] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  
  // ✅ YENİ: Bakiye State
  const [bakiye, setBakiye] = useState(null);
  
  const imzaRef = useRef();
  const izinTurleri = ["YILLIK İZİN", "MAZERET İZNİ", "RAPOR", "BABALIK İZNİ", "DOĞUM İZNİ", "DÜĞÜN İZNİ", "EVLİLİK İZNİ", "ÖLÜM İZNİ", "ÜCRETLİ İZİN", "ÜCRETSİZ İZİN"];
  const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

  useEffect(() => {
    // 1. Tatilleri Çek
    const tatilCek = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/izin/resmi-tatiller`, { headers: { 'Authorization': `Bearer ${token}`, 'bypass-tunnel-reminder': 'true' } });
        if(res.data) setResmiTatiller(res.data.map(t => t.tarih.split('T')[0]));
      } catch (e) { console.log("Tatil hatası"); }
    };
    tatilCek();

    // 2. ✅ YENİ: Bakiyeyi Çek
    const bakiyeCek = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/personel/bakiye`, { headers: { 'Authorization': `Bearer ${token}`, 'bypass-tunnel-reminder': 'true' } });
        setBakiye(res.data.kalan_izin);
      } catch (e) { console.log("Bakiye hatası"); }
    };
    bakiyeCek();

  }, []);

  useEffect(() => { hesapla(); }, [baslangicTarihi, gunSayisi, haftalikIzin, resmiTatiller]);
  useEffect(() => { if (adresSecimi === 'MEVCUT') setIzinAdresi(user.adres || ''); else setIzinAdresi(''); }, [adresSecimi]);

  const hesapla = () => {
    if(!gunSayisi || parseInt(gunSayisi) <= 0) return;
    let kalan = parseInt(gunSayisi);
    let curr = new Date(baslangicTarihi);
    while (kalan > 0) {
        const str = curr.toISOString().split('T')[0];
        const dayIdx = curr.getDay(); const dayName = dayIdx === 0 ? "Pazar" : gunler[dayIdx - 1];
        if (!resmiTatiller.includes(str) && dayName !== haftalikIzin) kalan--;
        if (kalan > 0) curr.setDate(curr.getDate() + 1);
    }
    setBitisTarihi(curr.toLocaleDateString('tr-TR'));
    let donus = new Date(curr); donus.setDate(donus.getDate() + 1);
    while (true) {
        const dStr = donus.toISOString().split('T')[0]; const dIdx = donus.getDay(); const dName = dIdx === 0 ? "Pazar" : gunler[dIdx - 1];
        if (!resmiTatiller.includes(dStr) && dName !== haftalikIzin) break;
        donus.setDate(donus.getDate() + 1);
    }
    setIseBaslama(donus.toLocaleDateString('tr-TR'));
  };

  // --- KAMERA ---
  const openCamera = async () => {
    try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("İzin Hatası", "Kamerayı kullanabilmek için ayarlardan izin veriniz.");
            return;
        }
        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
        });
        if (!result.canceled) setRaporDosyasi(result.assets[0]);
    } catch (error) { 
        Alert.alert("Hata Detayı", error.message || JSON.stringify(error)); 
    }
  };

  // --- GALERİ ---
  const openGallery = async () => {
    try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("İzin Hatası", "Galeriyi açabilmek için ayarlardan izin veriniz.");
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            allowsEditing: false,
        });
        if (!result.canceled) setRaporDosyasi(result.assets[0]);
    } catch (error) { 
        Alert.alert("Hata Detayı", error.message || JSON.stringify(error)); 
    }
  };

  const pickImage = () => {
    Alert.alert("Belge Yükle", "Seçiniz:", [
        { text: "📷 Kamera", onPress: openCamera },
        { text: "🖼️ Galeri", onPress: openGallery },
        { text: "İptal", style: "cancel" }
      ]
    );
  };

  const handleImzaOK = (signature) => { setImza(signature); setImzaModalAcik(false); };

  const gonder = async () => {
    if (!imza) { Alert.alert("Eksik", "Lütfen imza atınız."); return; }
    if (!izinAdresi) { Alert.alert("Eksik", "Adres bilgisi giriniz."); return; }
    if (izinTuru === 'RAPOR' && !raporDosyasi) { Alert.alert("Dikkat", "Rapor seçtiğiniz için belge yüklemelisiniz."); return; }

    setYukleniyor(true);
    try {
      const formData = new FormData();
      formData.append('baslangic_tarihi', baslangicTarihi.toISOString().split('T')[0]);
      formData.append('bitis_tarihi', bitisTarihi); 
      formData.append('ise_baslama', iseBaslama);
      formData.append('kac_gun', gunSayisi);
      formData.append('izin_turu', izinTuru);
      formData.append('haftalik_izin', haftalikIzin);
      formData.append('aciklama', aciklama);
      formData.append('izin_adresi', izinAdresi);
      formData.append('personel_imza', imza); 

      if (raporDosyasi) {
          const filename = raporDosyasi.uri.split('/').pop();
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image`;
          formData.append('belge', { uri: raporDosyasi.uri, name: filename, type });
      }

      await axios.post(`${API_URL}/api/izin/olustur`, formData, {
        headers: { 'Authorization': `Bearer ${token}`, 'bypass-tunnel-reminder': 'true', 'Content-Type': 'multipart/form-data' }
      });

      Alert.alert("Başarılı", "İzin talebiniz oluşturuldu! ✅");
      navigation.goBack();
    } catch (error) { Alert.alert("Hata", "Talep oluşturulamadı."); } finally { setYukleniyor(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>📝 Yeni İzin Talebi</Text>
      
      {/* ✅ YENİ: BAKİYE KARTI */}
      <View style={styles.bakiyeContainer}>
          <Text style={styles.bakiyeLabel}>Kalan Yıllık İzin Hakkınız</Text>
          <Text style={styles.bakiyeValue}>{bakiye !== null ? `${bakiye} Gün` : 'Hesaplanıyor...'}</Text>
      </View>

      <Text style={styles.label}>İzin Türü</Text>
      <View style={styles.pickerBox}><Picker selectedValue={izinTuru} onValueChange={setIzinTuru}>{izinTurleri.map(t=><Picker.Item key={t} label={t} value={t}/>)}</Picker></View>
      
      {izinTuru === 'RAPOR' && (
          <View style={styles.raporBox}>
              <Text style={styles.raporTitle}>⚠️ Rapor Belgesi Zorunludur</Text>
              <TouchableOpacity style={[styles.fotoBtn, raporDosyasi ? styles.fotoBtnOk : null]} onPress={pickImage}>
                  <Ionicons name={raporDosyasi ? "checkmark-circle" : "camera"} size={24} color="white" style={{marginRight:10}}/>
                  <Text style={{color:'white', fontWeight:'bold'}}>{raporDosyasi ? "Belge Eklendi" : "Fotoğraf Çek / Yükle"}</Text>
              </TouchableOpacity>
              {raporDosyasi && <Image source={{uri: raporDosyasi.uri}} style={styles.previewImg} />}
          </View>
      )}

      <Text style={styles.label}>Haftalık İzin</Text>
      <View style={styles.pickerBox}><Picker selectedValue={haftalikIzin} onValueChange={setHaftalikIzin}>{gunler.map(g=><Picker.Item key={g} label={g} value={g}/>)}</Picker></View>
      <Text style={styles.label}>Başlangıç Tarihi</Text>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}><Text style={styles.dateText}>📅 {baslangicTarihi.toLocaleDateString('tr-TR')}</Text></TouchableOpacity>
      {showPicker && (<DateTimePicker value={baslangicTarihi} mode="date" display="default" minimumDate={new Date()} onChange={(e, d) => { setShowPicker(false); if(d) setBaslangicTarihi(d); }} />)}
      <Text style={styles.label}>Gün Sayısı</Text>
      <TextInput style={styles.input} value={gunSayisi} onChangeText={setGunSayisi} keyboardType="numeric" />
      <View style={styles.autoBox}><Text style={styles.autoLabel}>İzin Bitiş: <Text style={styles.autoVal}>{bitisTarihi}</Text></Text><View style={styles.hr} /><Text style={styles.autoLabel}>İşe Başlama: <Text style={styles.autoValGreen}>{iseBaslama}</Text></Text></View>
      <Text style={styles.label}>İzin Adresi</Text>
      <View style={styles.radioRow}>
          <TouchableOpacity style={[styles.radioBtn, adresSecimi==='MEVCUT' && styles.radioActive]} onPress={()=>setAdresSecimi('MEVCUT')}><Text style={adresSecimi==='MEVCUT'?styles.textWhite:styles.textDark}>🏠 İkametgah</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.radioBtn, adresSecimi==='DIGER' && styles.radioActive]} onPress={()=>setAdresSecimi('DIGER')}><Text style={adresSecimi==='DIGER'?styles.textWhite:styles.textDark}>📍 Farklı Adres</Text></TouchableOpacity>
      </View>
      <TextInput style={[styles.input, {height: 60}]} value={izinAdresi} onChangeText={setIzinAdresi} multiline editable={adresSecimi === 'DIGER'} placeholder="Adres giriniz..." />
      <Text style={styles.label}>Açıklama</Text>
      <TextInput style={[styles.input, {height: 60}]} value={aciklama} onChangeText={setAciklama} multiline />
      <TouchableOpacity style={[styles.imzaBtn, imza ? styles.imzaBtnOk : null]} onPress={() => setImzaModalAcik(true)}><Ionicons name="pencil" size={20} color="white" style={{marginRight:10}}/><Text style={styles.imzaText}>{imza ? "İmzalandı" : "Talebi İmzala"}</Text></TouchableOpacity>
      {yukleniyor ? <ActivityIndicator size="large" color="#0d6efd" style={{marginTop:20}} /> : <TouchableOpacity style={styles.btn} onPress={gonder}><Text style={styles.btnText}>Gönder 🚀</Text></TouchableOpacity>}
      <Modal visible={imzaModalAcik} animationType="slide"><View style={{flex:1, padding: 20, paddingTop:50}}><Text style={{fontSize:20, fontWeight:'bold', textAlign:'center', marginBottom:10}}>Lütfen İmza Atınız</Text><View style={{height: 300, borderWidth:1, borderColor:'#ddd'}}><SignatureScreen ref={imzaRef} onOK={handleImzaOK} webStyle={`.m-signature-pad--footer {display: none; margin: 0px;}`} /></View><View style={{flexDirection:'row', justifyContent:'space-between', marginTop:20}}><TouchableOpacity style={styles.modalBtnCancel} onPress={()=>setImzaModalAcik(false)}><Text style={{color:'white'}}>İptal</Text></TouchableOpacity><TouchableOpacity style={styles.modalBtnClear} onPress={()=>imzaRef.current.clearSignature()}><Text style={{color:'white'}}>Temizle</Text></TouchableOpacity><TouchableOpacity style={styles.modalBtnSave} onPress={()=>imzaRef.current.readSignature()}><Text style={{color:'white'}}>Kaydet</Text></TouchableOpacity></View></View></Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f8f9fa', flexGrow: 1 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#0d6efd', marginBottom: 15, textAlign: 'center' },
  label: { fontWeight: 'bold', marginTop: 15, color: '#333', marginBottom: 5 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  pickerBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: 'white' },
  dateBtn: { backgroundColor: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#0d6efd', alignItems: 'center' },
  dateText: { color: '#0d6efd', fontWeight: 'bold', fontSize: 16 },
  autoBox: { backgroundColor: '#e9ecef', padding: 15, borderRadius: 10, marginTop: 20, borderLeftWidth: 5, borderLeftColor: '#6c757d' },
  autoLabel: { fontSize: 12, color: '#666' },
  autoVal: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  autoValGreen: { fontSize: 16, fontWeight: 'bold', color: '#28a745' },
  hr: { height: 1, backgroundColor: '#ccc', marginVertical: 10 },
  raporBox: { backgroundColor: '#fff3cd', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ffeeba', marginTop: 10 },
  raporTitle: { color: '#856404', fontWeight: 'bold', marginBottom: 10, textAlign:'center' },
  fotoBtn: { flexDirection: 'row', backgroundColor: '#0d6efd', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fotoBtnOk: { backgroundColor: '#198754' },
  previewImg: { width: '100%', height: 150, borderRadius: 8, marginTop: 10, resizeMode:'cover' },
  radioRow: { flexDirection: 'row', marginBottom: 10 },
  radioBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#0d6efd', alignItems: 'center', borderRadius: 5, marginHorizontal: 2 },
  radioActive: { backgroundColor: '#0d6efd' },
  textWhite: { color: 'white', fontWeight:'bold' },
  textDark: { color: '#0d6efd' },
  imzaBtn: { backgroundColor: '#6f42c1', padding: 15, borderRadius: 10, flexDirection:'row', justifyContent:'center', alignItems:'center', marginTop: 20 },
  imzaBtnOk: { backgroundColor: '#198754' },
  imzaText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btn: { backgroundColor: '#28a745', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20, marginBottom: 50 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  modalBtnCancel: { backgroundColor:'#6c757d', padding:15, borderRadius:5, flex:1, marginRight:5, alignItems:'center' },
  modalBtnClear: { backgroundColor:'#ffc107', padding:15, borderRadius:5, flex:1, marginHorizontal:5, alignItems:'center' },
  modalBtnSave: { backgroundColor:'#28a745', padding:15, borderRadius:5, flex:1, marginLeft:5, alignItems:'center' },
  bakiyeContainer: { backgroundColor: '#e8f5e9', padding: 15, borderRadius: 10, marginBottom: 15, borderLeftWidth: 5, borderLeftColor: '#28a745', alignItems: 'center' },
  bakiyeLabel: { fontSize: 14, color: '#2e7d32', fontWeight: '600' },
  bakiyeValue: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20', marginTop: 5 },
});