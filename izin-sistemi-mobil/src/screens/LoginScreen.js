import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Image, 
  ImageBackground, 
  KeyboardAvoidingView, 
  Platform,
  StatusBar
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// ✅ DÜZELTME 1: Config dosyası 'src' içinde olduğu için sadece bir üst dizine (../) çıkıyoruz.
import { API_URL } from '../config'; 

export default function LoginScreen({ navigation }) {
  const [tcNo, setTcNo] = useState('');
  const [sifre, setSifre] = useState('');
  const [beniHatirla, setBeniHatirla] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sifreGoster, setSifreGoster] = useState(false); 

  useEffect(() => { bilgileriGetir(); }, []);

  const bilgileriGetir = async () => {
    try {
      const kayitliVeri = await AsyncStorage.getItem('kullanici_giris');
      if (kayitliVeri) {
        const { tc, pass } = JSON.parse(kayitliVeri);
        setTcNo(tc); setSifre(pass); setBeniHatirla(true);
      }
    } catch (e) { console.log("Veri okunamadı"); }
  };

  const handleLogin = async () => {
    if(!tcNo || !sifre) { Alert.alert("Eksik Bilgi", "Lütfen TC Kimlik No ve Şifrenizi giriniz."); return; }
    
    setYukleniyor(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { tc_no: tcNo, sifre: sifre });

      if (beniHatirla) await AsyncStorage.setItem('kullanici_giris', JSON.stringify({ tc: tcNo, pass: sifre }));
      else await AsyncStorage.removeItem('kullanici_giris');

      navigation.navigate('Dashboard', { user: response.data.kullanici, token: response.data.token });
      
    } catch (error) {
      Alert.alert("Giriş Başarısız", "TC Kimlik No veya Şifre hatalı. Lütfen kontrol ediniz.");
    } finally { setYukleniyor(false); }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      
      {/* Arka plan görseli */}
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80' }} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          
          <View style={styles.logoContainer}>
            {/* ✅ DÜZELTME 2: Logo ana dizinde (assets) olduğu için iki üst dizine (../../) çıkıyoruz. */}
            <Image 
              source={require('../../assets/logombb.png')} 
              style={styles.logo} 
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>MERSİN BÜYÜKŞEHİR</Text>
            <Text style={styles.brandSubtitle}>BELEDİYESİ</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Personel Girişi</Text>
            <Text style={styles.cardSubHeader}>İKYS Sistemine Hoşgeldiniz</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="TC Kimlik No" 
                placeholderTextColor="#999"
                value={tcNo} 
                onChangeText={setTcNo} 
                keyboardType="number-pad" 
                maxLength={11}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Şifre" 
                placeholderTextColor="#999"
                value={sifre} 
                onChangeText={setSifre} 
                secureTextEntry={!sifreGoster} 
              />
              <TouchableOpacity onPress={() => setSifreGoster(!sifreGoster)}>
                <Ionicons name={sifreGoster ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.rowOptions}>
                <TouchableOpacity style={styles.rememberMe} onPress={() => setBeniHatirla(!beniHatirla)}>
                    <Ionicons name={beniHatirla ? "checkbox" : "square-outline"} size={22} color={beniHatirla ? "#0d6efd" : "#666"} />
                    <Text style={styles.rememberText}>Beni Hatırla</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('SifreUnuttum')}>
                    <Text style={styles.forgotText}>Şifremi Unuttum?</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleLogin} 
              disabled={yukleniyor}
              activeOpacity={0.8}
            >
              {yukleniyor ? 
                <ActivityIndicator size="small" color="#fff" /> : 
                <Text style={styles.buttonText}>GİRİŞ YAP</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Toplu Taşıma Şube Müdürlüğü - Hüseyin Arkan © 2026</Text>
            <Text style={styles.footerTextSmall}>v1.0.0</Text>
          </View>

        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(13, 110, 253, 0.85)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20
  },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 120, height: 120, marginBottom: 10 }, 
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  brandSubtitle: { fontSize: 18, fontWeight: '400', color: '#e0e0e0', letterSpacing: 2 },
  
  card: { 
    width: '100%', 
    backgroundColor: '#fff', 
    padding: 25, 
    borderRadius: 20, 
    elevation: 10, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  cardHeader: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  cardSubHeader: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 25 },
  
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f5f5f5', 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    height: 55,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee'
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#333' },
  
  rowOptions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  rememberMe: { flexDirection: 'row', alignItems: 'center' },
  rememberText: { marginLeft: 8, color: '#555', fontSize: 14 },
  forgotText: { color: '#0d6efd', fontWeight: '600', fontSize: 14 },
  
  button: { 
    backgroundColor: '#0d6efd', 
    height: 55, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#0d6efd',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  
  footer: { position: 'absolute', bottom: 30, alignItems: 'center' },
  footerText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  footerTextSmall: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }
});