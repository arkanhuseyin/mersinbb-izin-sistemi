import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config'; 
import { Save, Info, ArrowLeft } from 'lucide-react-native';

export default function KiyafetScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [donemAktif, setDonemAktif] = useState(false);
  const [form, setForm] = useState({ ayakkabi_no: '', tisort_beden: '', gomlek_beden: '', suveter_beden: '', mont_beden: '' });

  useEffect(() => {
    checkDonem();
  }, []);

  const checkDonem = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_URL}/api/personel/kiyafet-donemi`, { headers: { Authorization: `Bearer ${token}` } });
      setDonemAktif(res.data.aktif);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleKaydet = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(`${API_URL}/api/personel/beden-kaydet`, form, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Başarılı', 'Bedenler kaydedildi! ✅');
      navigation.goBack();
    } catch (e) { Alert.alert('Hata', e.response?.data?.mesaj || 'Hata oluştu'); }
  };

  if (loading) return <ActivityIndicator size="large" color="#cc0000" style={{marginTop:50}} />;

  if (!donemAktif) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft color="#fff" size={24} /></TouchableOpacity>
            <Text style={styles.title}>Kıyafet Talep</Text>
        </View>
        <View style={{padding:20, alignItems:'center', marginTop:50}}>
            <Info size={60} color="#cc0000" />
            <Text style={{fontSize:20, fontWeight:'bold', marginTop:20}}>Dönem Kapalı</Text>
            <Text style={{textAlign:'center', marginTop:10, color:'#666'}}>Şu an beden güncelleme dönemi aktif değildir. Lütfen Mayıs/Aralık dönemlerinde tekrar deneyiniz.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><ArrowLeft color="#fff" size={24} /></TouchableOpacity>
        <Text style={styles.title}>Beden Güncelle</Text>
      </View>
      <ScrollView contentContainerStyle={{padding:20}}>
        <Text style={styles.label}>Ayakkabı No</Text>
        <TextInput style={styles.input} placeholder="42" value={form.ayakkabi_no} onChangeText={t=>setForm({...form, ayakkabi_no:t})} keyboardType="numeric"/>

        <Text style={styles.label}>Tişört Beden</Text>
        <TextInput style={styles.input} placeholder="L" value={form.tisort_beden} onChangeText={t=>setForm({...form, tisort_beden:t})} />

        <Text style={styles.label}>Gömlek Beden</Text>
        <TextInput style={styles.input} placeholder="M" value={form.gomlek_beden} onChangeText={t=>setForm({...form, gomlek_beden:t})} />

        <Text style={styles.label}>Süveter Beden</Text>
        <TextInput style={styles.input} placeholder="L" value={form.suveter_beden} onChangeText={t=>setForm({...form, suveter_beden:t})} />

        <Text style={styles.label}>Mont Beden</Text>
        <TextInput style={styles.input} placeholder="XL" value={form.mont_beden} onChangeText={t=>setForm({...form, mont_beden:t})} />

        <TouchableOpacity style={styles.btn} onPress={handleKaydet}>
            <Save color="#fff" size={20} />
            <Text style={styles.btnText}> KAYDET</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1, backgroundColor:'#f5f5f5'},
  header: {backgroundColor:'#cc0000', padding:20, paddingTop:50, flexDirection:'row', alignItems:'center'},
  title: {color:'#fff', fontSize:18, fontWeight:'bold', marginLeft:10},
  label: {marginTop:15, fontWeight:'bold', color:'#333'},
  input: {backgroundColor:'#fff', padding:10, borderRadius:8, borderWidth:1, borderColor:'#ddd', marginTop:5},
  btn: {backgroundColor:'#cc0000', padding:15, borderRadius:8, flexDirection:'row', justifyContent:'center', marginTop:30, alignItems:'center'},
  btnText: {color:'#fff', fontWeight:'bold'}
});