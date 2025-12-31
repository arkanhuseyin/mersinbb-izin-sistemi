import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

// ✅ DOĞRU YOL: Bir üst klasöre (src) çıkıp config'i alıyoruz.
import { API_URL } from '../config'; 

import {
  User,
  Phone,
  MapPin,
  Briefcase,
  CreditCard,
  LogOut,
  Shirt,
  ChevronRight
} from 'lucide-react-native';

export default function ProfilScreen() {
  const navigation = useNavigation();
  const route = useRoute(); 

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🔁 Ekran her açıldığında API’den profil çek
  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [])
  );

  const fetchUserProfile = async () => {
    try {
      if (!refreshing) setLoading(true);

      // 1. ADIM: Token'ı önce parametreden, yoksa hafızadan al
      let token = route.params?.token;
      if (!token) {
          token = await AsyncStorage.getItem('userToken');
      }

      if (!token) {
        // Token yoksa sessizce login ekranına atabiliriz
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      // 2. ADIM: Veriyi Çek
      const response = await axios.get(`${API_URL}/api/personel/bilgi`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'bypass-tunnel-reminder': 'true'
        }
      });

      setUser(response.data);

      // 3. ADIM: Verileri Tazele (Cache Güncelle)
      await AsyncStorage.setItem('userData', JSON.stringify(response.data));
      if(route.params?.token) {
          await AsyncStorage.setItem('userToken', token);
      }

    } catch (error) {
      console.log('Profil API hatası:', error?.message);
      
      // Hata durumunda eski veriyi göster
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
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <User color="#cc0000" size={40} />
        </View>
        <Text style={styles.nameText}>
          {user?.ad} {user?.soyad}
        </Text>
        <Text style={styles.roleText}>
          {user?.unvani || user?.gorevi || 'Personel'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* KİŞİSEL BİLGİLER */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>

          <InfoRow icon={<CreditCard size={20} color="#666" />} label="TC Kimlik No" value={user?.tc_no} />
          <Divider />
          <InfoRow icon={<Phone size={20} color="#666" />} label="Telefon" value={user?.telefon} />
          <Divider />
          <InfoRow icon={<MapPin size={20} color="#666" />} label="Adres" value={user?.adres} />
        </View>

        {/* KURUMSAL BİLGİLER */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kurumsal Bilgiler</Text>

          <InfoRow icon={<Briefcase size={20} color="#666" />} label="Birim" value={user?.birim_adi} />
          <Divider />
          <InfoRow label="Sicil No" value={user?.sicil_no} />
          <Divider />
          <InfoRow label="Kadro" value={user?.kadro_tipi} />
        </View>

        {/* LOJİSTİK & BEDEN */}
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
            <ChevronRight size={16} color="#cc0000" />
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

/* 🔹 KÜÇÜK BİLEŞENLER */

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.row}>
    {icon}
    <View style={styles.rowContent}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '-'}</Text>
    </View>
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
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  nameText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  roleText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },

  content: { padding: 20, marginTop: -20 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
  },

  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },

  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  rowContent: { marginLeft: 15, flex: 1 },
  label: { fontSize: 12, color: '#999' },
  value: { fontSize: 15, color: '#333', fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 5 },

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
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },

  bedenLabel: { fontSize: 10, color: '#666' },
  bedenValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },

  editButton: {
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff0f0',
    borderRadius: 8,
  },

  editButtonText: {
    color: '#cc0000',
    fontWeight: '600',
    marginRight: 5,
    fontSize: 13,
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