import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

// ✅ Config dosyasından API linkini alıyoruz
import { API_URL } from '../config';

import {
  User,
  Phone,
  MapPin,
  Briefcase,
  CreditCard,
  LogOut,
  Shirt,
  Settings as SettingsIcon
} from 'lucide-react-native';

export default function ProfilScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🔁 Ekran her açıldığında verileri tazeler
  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [])
  );

  const fetchUserProfile = async () => {
    try {
      if (!refreshing) setLoading(true);

      // 1. Token Kontrolü (Parametreden veya Hafızadan)
      let token = route.params?.token;
      if (!token) {
        token = await AsyncStorage.getItem('userToken');
      }

      if (!token) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      // 2. Veriyi Çek
      const response = await axios.get(`${API_URL}/api/personel/bilgi`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'bypass-tunnel-reminder': 'true'
        }
      });

      setUser(response.data);

      // 3. Hafızayı Güncelle
      await AsyncStorage.setItem('userData', JSON.stringify(response.data));
      if (route.params?.token) {
        await AsyncStorage.setItem('userToken', token);
      }

    } catch (error) {
      console.log('Profil API hatası:', error?.message);
      // Hata durumunda (internet yoksa) eski veriyi göster
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserProfile();
  };

  const handleLogout = async () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['userToken', 'userData']);
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }]
          });
        }
      }
    ]);
  };

  if (loading && !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#cc0000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* --- HEADER --- */}
      <View style={styles.header}>
        
        {/* AYARLAR BUTONU (Sağ Üst) */}
        <TouchableOpacity 
            style={styles.settingsBtn} 
            onPress={() => navigation.navigate('Ayarlar')}
        >
            <SettingsIcon color="white" size={26} />
        </TouchableOpacity>

        {/* AVATAR ALANI */}
        <View style={styles.avatarContainer}>
          {user?.fotograf_yolu ? (
              // Eğer backend tam URL gönderiyorsa direkt uri, 
              // yoksa başına API_URL eklemek gerekebilir. Şimdilik direkt uri varsayıyoruz.
              <Image 
                source={{ uri: user.fotograf_yolu.startsWith('http') ? user.fotograf_yolu : `${API_URL}/${user.fotograf_yolu}` }} 
                style={styles.avatarImage} 
              />
          ) : (
              <User color="#cc0000" size={40} />
          )}
        </View>

        <Text style={styles.nameText}>
          {user?.ad} {user?.soyad}
        </Text>
        
        {/* Rol Yerine Görev Yazılması İstendi */}
        <Text style={styles.roleText}>
          {user?.gorev || 'Personel'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* 1. KİŞİSEL BİLGİLER */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
          
          <InfoRow icon={<CreditCard size={18} color="#666"/>} label="TC Kimlik No" value={user?.tc_no} />
          <Divider />
          <InfoRow icon={<Phone size={18} color="#666"/>} label="Telefon" value={user?.telefon} />
          <Divider />
          <InfoRow icon={<Briefcase size={18} color="#666"/>} label="E-Posta" value={user?.email} />
          <Divider />
          <InfoRow icon={<MapPin size={18} color="#666"/>} label="Adres" value={user?.adres} />
        </View>

        {/* 2. KURUMSAL BİLGİLER */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kurumsal Bilgiler</Text>

          <InfoRow label="Birim / Görev" value={user?.gorev} /> 
          <Divider />
          <InfoRow label="Sicil Numarası" value={user?.sicil_no} />
          <Divider />
          <InfoRow label="Kadrosu" value={user?.kadro_tipi} />
        </View>

        {/* 3. LOJİSTİK & BEDEN */}
        <View style={styles.card}>
          <View style={styles.bedenHeader}>
            <Text style={styles.cardTitle}>Lojistik & Beden Bilgileri</Text>
            <Shirt size={20} color="#cc0000" />
          </View>

          <View style={styles.bedenGrid}>
            <Beden label="Ayakkabı" value={user?.ayakkabi_no} />
            <Beden label="Tişört" value={user?.tisort_beden} />
            <Beden label="Gömlek" value={user?.gomlek_beden} />
            <Beden label="Mont" value={user?.mont_beden} />
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('Kiyafet')}
          >
            <Text style={styles.editButtonText}>Beden Bilgilerini Güncelle</Text>
          </TouchableOpacity>
        </View>

        {/* ÇIKIŞ */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutText}>Oturumu Kapat</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

/* 🔹 YARDIMCI BİLEŞENLER */

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.row}>
    <View style={{flexDirection:'row', alignItems:'center'}}>
        {icon && <View style={{marginRight:8}}>{icon}</View>}
        <Text style={styles.label}>{label}</Text>
    </View>
    <Text style={styles.value}>{value || '-'}</Text>
  </View>
);

const Divider = () => <View style={styles.divider} />;

const Beden = ({ label, value }) => (
  <View style={styles.bedenItem}>
    <Text style={styles.bedenLabel}>{label}</Text>
    <Text style={styles.bedenValue}>{value || '-'}</Text>
  </View>
);

/* 🔹 STYLES */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: '#cc0000',
    paddingTop: 50,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative'
  },
  
  settingsBtn: {
    position: 'absolute',
    top: 50, // StatusBar boşluğu
    right: 20,
    padding: 8,
    zIndex: 10
  },

  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden'
  },
  avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover'
  },

  nameText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  roleText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },

  content: { padding: 20, marginTop: -20 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3, // Android gölge
    shadowColor: '#000', // iOS gölge
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },

  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 15 },

  row: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginVertical: 8 
  },
  
  label: { fontSize: 14, color: '#777' },
  value: { fontSize: 14, color: '#333', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 5 },

  bedenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },

  bedenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },

  bedenItem: {
    width: '23%',
    backgroundColor: '#f9f9f9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },

  bedenLabel: { fontSize: 11, color: '#666', marginBottom: 2 },
  bedenValue: { fontSize: 15, fontWeight: 'bold', color: '#333' },

  editButton: {
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffccd5'
  },

  editButtonText: {
    color: '#cc0000',
    fontWeight: 'bold',
    fontSize: 14,
  },

  logoutButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },

  logoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
});