import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { User, Phone, MapPin, Briefcase, CreditCard, LogOut, Shirt, ChevronRight } from 'lucide-react-native';

export default function ProfilScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sayfaya her gelindiğinde verileri tazele (Beden güncelleyince görünsün diye)
  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [])
  );

  const fetchUserProfile = async () => {
    try {
      // Not: Normalde en güncel veriyi veritabanından çekmek gerekir.
      // Şimdilik AsyncStorage'daki veriyi kullanıyoruz.
      // Backend'de '/me' endpoint'i varsa oradan çekmek daha sağlıklı olur.
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }}
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserProfile();
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#cc0000" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
            <User color="#cc0000" size={40} />
        </View>
        <Text style={styles.nameText}>{user?.ad} {user?.soyad}</Text>
        <Text style={styles.roleText}>{user?.unvani || user?.gorevi}</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        
        {/* 1. KİŞİSEL BİLGİLER */}
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>
            
            <View style={styles.row}>
                <CreditCard size={20} color="#666" />
                <View style={styles.rowContent}>
                    <Text style={styles.label}>TC Kimlik No</Text>
                    <Text style={styles.value}>{user?.tc_no}</Text>
                </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
                <Phone size={20} color="#666" />
                <View style={styles.rowContent}>
                    <Text style={styles.label}>Telefon</Text>
                    <Text style={styles.value}>{user?.telefon || '-'}</Text>
                </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
                <MapPin size={20} color="#666" />
                <View style={styles.rowContent}>
                    <Text style={styles.label}>Adres</Text>
                    <Text style={styles.value}>{user?.adres || '-'}</Text>
                </View>
            </View>
        </View>

        {/* 2. KURUMSAL BİLGİLER */}
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Kurumsal Bilgiler</Text>
            <View style={styles.row}>
                <Briefcase size={20} color="#666" />
                <View style={styles.rowContent}>
                    <Text style={styles.label}>Birim</Text>
                    <Text style={styles.value}>{user?.birim_adi || '-'}</Text>
                </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
                <View style={styles.rowContent}>
                    <Text style={styles.label}>Sicil No</Text>
                    <Text style={styles.value}>{user?.sicil_no || '-'}</Text>
                </View>
                <View style={styles.rowContent}>
                    <Text style={styles.label}>Kadro</Text>
                    <Text style={styles.value}>{user?.kadro_tipi || '-'}</Text>
                </View>
            </View>
        </View>

        {/* ✅ 3. YENİ EKLENEN: LOJİSTİK VE BEDEN BİLGİLERİ */}
        <View style={styles.card}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                <Text style={styles.cardTitle}>Lojistik & Beden Bilgileri</Text>
                <Shirt size={20} color="#cc0000" />
            </View>
            
            <View style={styles.bedenGrid}>
                <View style={styles.bedenItem}>
                    <Text style={styles.bedenLabel}>Ayakkabı</Text>
                    <Text style={styles.bedenValue}>{user?.ayakkabi_no || '-'}</Text>
                </View>
                <View style={styles.bedenItem}>
                    <Text style={styles.bedenLabel}>Tişört</Text>
                    <Text style={styles.bedenValue}>{user?.tisort_beden || '-'}</Text>
                </View>
                <View style={styles.bedenItem}>
                    <Text style={styles.bedenLabel}>Gömlek</Text>
                    <Text style={styles.bedenValue}>{user?.gomlek_beden || '-'}</Text>
                </View>
                <View style={styles.bedenItem}>
                    <Text style={styles.bedenLabel}>Mont</Text>
                    <Text style={styles.bedenValue}>{user?.mont_beden || '-'}</Text>
                </View>
            </View>

            {/* BUTON: Tıklayınca 'Kiyafet' ekranına gider */}
            <TouchableOpacity 
                style={styles.editButton}
                onPress={() => navigation.navigate('Kiyafet')}
            >
                <Text style={styles.editButtonText}>Beden Bilgilerini Güncelle</Text>
                <ChevronRight size={16} color="#cc0000" />
            </TouchableOpacity>
        </View>

        {/* ÇIKIŞ BUTONU */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#fff" />
            <Text style={styles.logoutText}>Oturumu Kapat</Text>
        </TouchableOpacity>
        
        <View style={{height: 30}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    backgroundColor: '#cc0000', paddingTop: 60, paddingBottom: 30, alignItems: 'center',
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
  },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10
  },
  nameText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  roleText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },

  content: { padding: 20, marginTop: -20 },
  
  card: {
    backgroundColor: '#fff', borderRadius: 15, padding: 20, marginBottom: 15,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  rowContent: { marginLeft: 15, flex: 1 },
  label: { fontSize: 12, color: '#999' },
  value: { fontSize: 15, color: '#333', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 5 },

  // Beden Tablosu
  bedenGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bedenItem: { 
    width: '23%', backgroundColor: '#f9f9f9', padding: 8, borderRadius: 8, 
    alignItems: 'center', marginBottom: 10, borderWidth:1, borderColor:'#eee' 
  },
  bedenLabel: { fontSize: 10, color: '#666', marginBottom: 2 },
  bedenValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },

  editButton: {
    marginTop: 5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 12, backgroundColor: '#fff0f0', borderRadius: 8
  },
  editButtonText: { color: '#cc0000', fontWeight: '600', marginRight: 5, fontSize: 13 },

  logoutButton: {
    backgroundColor: '#333', borderRadius: 12, padding: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10
  },
  logoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 }
});