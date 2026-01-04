import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config'; // <--- MERKEZİ LINKI ÇAĞIRDIK

export default function LoginScreen({ navigation }) {
  const [tcNo, setTcNo] = useState('');
  const [sifre, setSifre] = useState('');
  const [beniHatirla, setBeniHatirla] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

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
    if(!tcNo || !sifre) { Alert.alert("Uyarı", "Lütfen bilgileri doldurunuz."); return; }
    
    setYukleniyor(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { tc_no: tcNo, sifre: sifre }, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });

      if (beniHatirla) await AsyncStorage.setItem('kullanici_giris', JSON.stringify({ tc: tcNo, pass: sifre }));
      else await AsyncStorage.removeItem('kullanici_giris');

      navigation.navigate('Dashboard', { user: response.data.kullanici, token: response.data.token });
      
    } catch (error) {
      Alert.alert("Hata", "Giriş yapılamadı. Bilgiler yanlış veya sunucu kapalı.");
    } finally { setYukleniyor(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Mersin Büyükşehir Belediyesi</Text>
        <Text style={styles.subtitle}>İnsan Kaynakları Modülü - İKYS </Text>
        <Text style={styles.label}>TC Kimlik No</Text>
        <TextInput style={styles.input} value={tcNo} onChangeText={setTcNo} keyboardType="number-pad" />
        <Text style={styles.label}>Şifre</Text>
        <TextInput style={styles.input} placeholder="******" placeholderTextColor="#999" value={sifre} onChangeText={setSifre} secureTextEntry={true} />
        
        <View style={styles.rowOptions}>
            <TouchableOpacity style={styles.rememberMe} onPress={() => setBeniHatirla(!beniHatirla)}>
                <Ionicons name={beniHatirla ? "checkbox" : "square-outline"} size={24} color={beniHatirla ? "#0d6efd" : "#666"} />
                <Text style={styles.rememberText}>Beni Hatırla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('SifreUnuttum')}>
                <Text style={styles.forgotText}>Şifremi Unuttum?</Text>
            </TouchableOpacity>
        </View>

        {yukleniyor ? <ActivityIndicator size="large" color="#0d6efd" /> : 
            <TouchableOpacity style={styles.button} onPress={handleLogin}><Text style={styles.buttonText}>Giriş Yap</Text></TouchableOpacity>
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5', justifyContent: 'center', alignItems: 'center' },
  card: { width: '85%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0d6efd', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6c757d', textAlign: 'center', marginBottom: 20 },
  label: { fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 12, marginBottom: 15, fontSize: 16, color: '#000' },
  rowOptions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  rememberMe: { flexDirection: 'row', alignItems: 'center' },
  rememberText: { marginLeft: 5, color: '#333' },
  forgotText: { color: '#0d6efd', fontWeight: 'bold' },
  button: { backgroundColor: '#0d6efd', padding: 15, borderRadius: 5, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});