import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native'; 
import { Plus, CheckCircle } from 'lucide-react-native';
import moment from 'moment';
import 'moment/locale/tr'; 

// Config dosyasından API linkini alıyoruz
import { API_URL } from '../config'; 

export default function TalepYonetimiScreen({ navigation }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    
    // Form State
    const [type, setType] = useState('Öneri');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [kvkk, setKvkk] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchRequests();
        }, [])
    );

    // 🛠️ YARDIMCI: Token Temizleme Fonksiyonu
    const getToken = async () => {
        try {
            let token = await AsyncStorage.getItem('userToken');
            if (token) {
                // Tırnakları temizle (Çift koruma)
                return token.replace(/^"|"$/g, '');
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            if (!token) return; // Token yoksa işlem yapma
            
            const res = await axios.get(`${API_URL}/api/talep/listele`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data);
        } catch (error) {
            console.log("Liste Çekme Hatası:", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        // Validasyonlar
        if (!kvkk) return Alert.alert("Onay Gerekli", "Lütfen KVKK aydınlatma metnini onaylayınız.");
        if (!subject.trim()) return Alert.alert("Eksik Bilgi", "Lütfen bir konu başlığı giriniz.");
        if (!message.trim()) return Alert.alert("Eksik Bilgi", "Lütfen mesajınızı yazınız.");

        try {
            const token = await getToken();
            
            if (!token) {
                Alert.alert("Oturum Hatası", "Oturumunuz sonlanmış. Lütfen tekrar giriş yapın.");
                // İstersen burada otomatik login ekranına atabilirsin
                // navigation.replace('Login');
                return;
            }

            console.log("Giden Veri:", { tur: type, konu: subject, mesaj: message });

            await axios.post(`${API_URL}/api/talep/olustur`, 
                { 
                    tur: type, 
                    konu: subject, 
                    mesaj: message, 
                    kvkk: true 
                }, 
                { 
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json' 
                    } 
                }
            );
            
            Alert.alert("Başarılı", "Talebiniz sisteme iletildi.");
            setModalVisible(false);
            
            // Formu Temizle
            setSubject(''); 
            setMessage(''); 
            setKvkk(false);
            setType('Öneri');
            
            // Listeyi Güncelle
            fetchRequests();

        } catch (error) {
            console.error("Kayıt Hatası Detayı:", error);
            
            // Sunucudan gelen net hatayı göster
            const sunucuMesaji = error.response?.data?.mesaj || error.response?.data?.error || "Sunucuya bağlanılamadı.";
            Alert.alert("İşlem Başarısız", sunucuMesaji);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.card} 
            onPress={() => navigation.navigate('ChatScreen', { request: item })}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.badge, 
                    { backgroundColor: item.tur === 'Şikayet' ? '#fee2e2' : item.tur === 'Öneri' ? '#dcfce7' : '#e0f2fe' }]}>
                    <Text style={[styles.badgeText, 
                        { color: item.tur === 'Şikayet' ? '#dc2626' : item.tur === 'Öneri' ? '#16a34a' : '#0284c7' }]}>
                        {item.tur}
                    </Text>
                </View>
                <Text style={styles.date}>{moment(item.son_guncelleme).format('DD MMM, HH:mm')}</Text>
            </View>
            
            <Text style={styles.title} numberOfLines={1}>{item.konu}</Text>
            
            <View style={styles.cardFooter}>
                <Text style={styles.sender}>{item.gorunen_ad}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.durum === 'AÇIK' ? '#fef9c3' : item.durum === 'KAPANDI' ? '#e5e7eb' : '#dbeafe' }]}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#4b5563' }}>{item.durum}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Destek Merkezi</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                    <Plus color="#fff" size={24} />
                </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? <ActivityIndicator size="large" color="#2563eb" style={{marginTop: 20}} /> : (
                <FlatList
                    data={requests}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ padding: 16 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>Henüz bir talep bulunmamaktadır.</Text>}
                />
            )}

            {/* Create Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Yeni Talep Oluştur</Text>
                        
                        <View style={styles.typeSelector}>
                            {['Öneri', 'Şikayet', 'Talep'].map(t => (
                                <TouchableOpacity key={t} 
                                    style={[styles.typeButton, type === t && styles.activeType]} 
                                    onPress={() => setType(t)}>
                                    <Text style={[styles.typeText, type === t && styles.activeTypeText]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput 
                            style={styles.input} 
                            placeholder="Konu Başlığı" 
                            value={subject} 
                            onChangeText={setSubject}
                        />
                        <TextInput 
                            style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                            placeholder="Mesajınız..." 
                            multiline 
                            value={message} 
                            onChangeText={setMessage}
                        />

                        <TouchableOpacity style={styles.kvkkContainer} onPress={() => setKvkk(!kvkk)}>
                            <View style={[styles.checkbox, kvkk && styles.checked]}>
                                {kvkk && <CheckCircle size={14} color="#fff" />}
                            </View>
                            <Text style={styles.kvkkText}>KVKK kapsamında verilerimin işlenmesini kabul ediyorum.</Text>
                        </TouchableOpacity>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.btnText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate}>
                                <Text style={[styles.btnText, { color: '#fff' }]}>Gönder</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', elevation: 2 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
    addButton: { backgroundColor: '#2563eb', padding: 10, borderRadius: 50 },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 10, fontWeight: 'bold' },
    date: { fontSize: 10, color: '#9ca3af' },
    title: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sender: { fontSize: 12, color: '#6b7280' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#9ca3af' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 },
    typeSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    typeButton: { flex: 1, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginHorizontal: 2 },
    activeType: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    typeText: { fontSize: 12, color: '#4b5563' },
    activeTypeText: { color: '#fff', fontWeight: 'bold' },
    kvkkContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#2563eb', borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
    checked: { backgroundColor: '#2563eb' },
    kvkkText: { fontSize: 11, color: '#6b7280', flex: 1 },
    modalButtons: { flexDirection: 'row', gap: 10 },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#f3f4f6', alignItems: 'center' },
    submitBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' },
    btnText: { fontWeight: 'bold', color: '#374151' }
});