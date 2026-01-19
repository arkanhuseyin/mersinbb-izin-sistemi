import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet, Alert, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import axios from 'axios'; // AsyncStorage sildik, gerek kalmadı.
import { useFocusEffect } from '@react-navigation/native'; 
import { Plus, CheckCircle, Clock, X, MessageSquare } from 'lucide-react-native';
import moment from 'moment';
import 'moment/locale/tr'; 

import { API_URL } from '../config'; 

// Renk Paleti
const COLORS = {
    primary: '#2563EB',
    secondary: '#F8FAFC',
    card: '#FFFFFF',
    textDark: '#1E293B',
    textLight: '#64748B',
    success: '#10B981',
    danger: '#EF4444',
    border: '#E2E8F0'
};

export default function TalepYonetimiScreen({ route, navigation }) {
    // 🛠️ KRİTİK DEĞİŞİKLİK: Token'ı artık parametreden alıyoruz! (İzinTalepScreen ile aynı)
    const { user, token } = route.params; 

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    
    const [type, setType] = useState('Öneri');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [kvkk, setKvkk] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if(token) fetchRequests();
        }, [token])
    );

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // AsyncStorage kullanmıyoruz, doğrudan elimizdeki token'ı kullanıyoruz
            const res = await axios.get(`${API_URL}/api/talep/listele`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data);
        } catch (error) {
            console.log("Liste Hatası:", error.message);
            // 401 Hatası (Yetkisiz) durumunda listeyi boşalt
            if(error.response && error.response.status === 401) setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!kvkk) return Alert.alert("Onay Gerekli", "Lütfen KVKK metnini onaylayınız.");
        if (!subject.trim() || !message.trim()) return Alert.alert("Eksik Bilgi", "Konu ve mesaj alanları zorunludur.");

        try {
            await axios.post(`${API_URL}/api/talep/olustur`, 
                { tur: type, konu: subject, mesaj: message, kvkk: true }, 
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
            
            Alert.alert("Başarılı", "Talebiniz iletildi. 🚀");
            setModalVisible(false);
            setSubject(''); setMessage(''); setKvkk(false); setType('Öneri');
            fetchRequests(); 

        } catch (error) {
            const msg = error.response?.data?.mesaj || "Sunucu hatası.";
            Alert.alert("Hata", msg);
        }
    };

    const getTypeColor = (t) => {
        if(t === 'Şikayet') return { bg: '#FEF2F2', text: COLORS.danger };
        if(t === 'Öneri') return { bg: '#ECFDF5', text: COLORS.success };
        return { bg: '#EFF6FF', text: COLORS.primary };
    };

    const renderItem = ({ item }) => {
        const typeStyle = getTypeColor(item.tur);
        return (
            <TouchableOpacity 
                style={styles.card} 
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ChatScreen', { request: item, token, user })}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: typeStyle.bg }]}>
                        <Text style={[styles.badgeText, { color: typeStyle.text }]}>{item.tur}</Text>
                    </View>
                    <View style={styles.dateContainer}>
                        <Clock size={12} color={COLORS.textLight} />
                        <Text style={styles.date}>{moment(item.son_guncelleme).format('DD MMM')}</Text>
                    </View>
                </View>
                
                <Text style={styles.title} numberOfLines={1}>{item.konu}</Text>
                
                <View style={styles.cardFooter}>
                    <View style={styles.senderContainer}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{item.gorunen_ad?.charAt(0) || '?'}</Text>
                        </View>
                        <Text style={styles.sender}>{item.gorunen_ad}</Text>
                    </View>
                    
                    <View style={[styles.statusBadge, { 
                        backgroundColor: item.durum === 'AÇIK' ? '#FFFBEB' : item.durum === 'KAPANDI' ? '#F1F5F9' : '#EFF6FF',
                        borderColor: item.durum === 'AÇIK' ? '#FCD34D' : item.durum === 'KAPANDI' ? '#CBD5E1' : '#BFDBFE'
                    }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textDark }}>
                            {item.durum}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.secondary} />
            
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Destek Merkezi</Text>
                    <Text style={styles.headerSubtitle}>Taleplerinizi buradan yönetin</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                    <Plus color="#fff" size={24} strokeWidth={2.5} />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 50}} /> : (
                <FlatList
                    data={requests}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MessageSquare size={64} color="#CBD5E1" />
                            <Text style={styles.emptyText}>Henüz bir talep bulunamadı.</Text>
                        </View>
                    }
                />
            )}

            <Modal visible={modalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Yeni Talep Oluştur</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color={COLORS.textLight} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.typeSelector}>
                            {['Öneri', 'Şikayet', 'Talep'].map(t => {
                                const isSelected = type === t;
                                return (
                                    <TouchableOpacity key={t} 
                                        style={[styles.typeButton, isSelected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]} 
                                        onPress={() => setType(t)}>
                                        <Text style={[styles.typeText, isSelected && { color: '#fff' }]}>{t}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>

                        <Text style={styles.label}>Konu</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="Konu Başlığını Yazınız..." 
                            value={subject} 
                            onChangeText={setSubject} 
                        />

                        <Text style={styles.label}>Mesaj</Text>
                        <TextInput 
                            style={[styles.input, styles.textArea]} 
                            placeholder="Detayları buraya yazınız..." 
                            multiline 
                            value={message} 
                            onChangeText={setMessage} 
                        />

                        <TouchableOpacity style={styles.kvkkContainer} onPress={() => setKvkk(!kvkk)} activeOpacity={0.8}>
                            <View style={[styles.checkbox, kvkk && styles.checked]}>
                                {kvkk && <CheckCircle size={14} color="#fff" />}
                            </View>
                            <Text style={styles.kvkkText}>KVKK metnini okudum, onaylıyorum.</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleCreate}>
                            <Text style={styles.submitBtnText}>TALEBİ GÖNDER</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.secondary },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: COLORS.secondary },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textDark, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
    addButton: { backgroundColor: COLORS.primary, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:8, elevation: 5 },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.7 },
    emptyText: { marginTop: 16, color: COLORS.textLight, fontSize: 16 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    dateContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    date: { fontSize: 11, color: COLORS.textLight, fontWeight: '500' },
    title: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 16, lineHeight: 22 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
    senderContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary },
    sender: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textDark },
    typeSelector: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    typeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
    typeText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
    label: { fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 8, marginLeft: 4 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.textDark, marginBottom: 16 },
    textArea: { height: 100, textAlignVertical: 'top' },
    kvkkContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    checked: { backgroundColor: COLORS.primary },
    kvkkText: { fontSize: 13, color: COLORS.textLight, flex: 1 },
    submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:8 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }
});