import React, { useState, useCallback } from 'react'; // useCallback eklendi
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native'; // <-- BU ÇOK ÖNEMLİ
import axios from 'axios';
import { API_URL } from '../config';

export default function BildirimScreen({ route, navigation }) {
  const { user, token } = route.params;
  const [bildirimler, setBildirimler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  // EKRAN HER ODAKLANDIĞINDA (AÇILDIĞINDA) ÇALIŞIR
  useFocusEffect(
    useCallback(() => {
      verileriCek();
    }, [])
  );

  const verileriCek = async () => {
    setYukleniyor(true);
    try {
      const response = await axios.get(`${API_URL}/api/izin/bildirim/listele`, {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'bypass-tunnel-reminder': 'true'
        }
      });
      setBildirimler(response.data);
    } catch (error) {
      console.log("Bildirim hatası:", error);
    } finally {
        setYukleniyor(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🔔 Bildirimler</Text>

      {yukleniyor && <ActivityIndicator size="large" color="#0d6efd" />}

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        
        {!yukleniyor && bildirimler.length === 0 && (
            <Text style={styles.bosMesaj}>Henüz bir bildiriminiz yok.</Text>
        )}

        {bildirimler.map((b) => {
          // Acil veya Red durumunda kartı kırmızı yapalım
          const isCritical = b.baslik.includes('🚨') || b.baslik.includes('❌') || b.baslik.includes('⚠️');

          return (
            <View key={b.id} style={[styles.card, isCritical ? styles.kirmiziKart : null]}>
              <View style={styles.cardHeader}>
                  <Text style={[styles.title, isCritical ? {color: '#dc3545'} : null]}>
                    {b.baslik}
                  </Text>
                  <Text style={styles.date}>
                    {new Date(b.tarih).toLocaleDateString('tr-TR')} {new Date(b.tarih).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                  </Text>
              </View>
              
              <View style={styles.divider} />
              
              <Text style={styles.message}>{b.mesaj}</Text>
            </View>
          );
        })}

      </ScrollView>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>Geri Dön</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20, paddingTop: 50 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign:'center' },
  
  bosMesaj: { textAlign: 'center', color: '#999', marginTop: 50, fontSize: 16 },
  
  card: { 
      backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 3, 
      borderLeftWidth: 5, borderLeftColor: '#0d6efd' 
  },
  
  kirmiziKart: { 
      borderLeftColor: '#dc3545', 
      backgroundColor: '#fff5f5' 
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  title: { fontWeight: 'bold', fontSize: 16, color: '#333', flex: 1, marginRight: 10 },
  date: { fontSize: 11, color: '#999', marginTop: 2 },
  
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  
  message: { fontSize: 14, color: '#555', lineHeight: 20 },

  backButton: { backgroundColor: '#6c757d', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  backButtonText: { color: 'white', fontWeight: 'bold' }
});

// deneme