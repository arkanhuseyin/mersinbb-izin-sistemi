import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Send, Archive, Check } from 'lucide-react-native';
import moment from 'moment';
import 'moment/locale/tr'; 

// ✅ Config'den çekiyoruz
import { API_URL } from '../config';

export default function ChatScreen({ route, navigation }) {
    const { request } = route.params;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isClosed, setIsClosed] = useState(request.durum === 'KAPANDI');
    const [sending, setSending] = useState(false);
    
    const flatListRef = useRef();

    useEffect(() => {
        fetchMessages();
        // 3 saniyede bir yeni mesaj var mı bak
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchMessages = async () => {
        try {
            let token = await AsyncStorage.getItem('userToken');
            if (token) token = token.replace(/^"|"$/g, '');

            const res = await axios.get(`${API_URL}/api/talep/detay/${request.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(res.data);
        } catch (error) {
            console.error("Mesajlar çekilemedi:", error);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        setSending(true);
        
        try {
            let token = await AsyncStorage.getItem('userToken');
            if (token) token = token.replace(/^"|"$/g, '');
            
            let yeniDurum = null; 
            
            await axios.post(`${API_URL}/api/talep/cevapla`, 
                { talep_id: request.id, mesaj: newMessage, yeni_durum: yeniDurum },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setNewMessage('');
            fetchMessages(); 
            
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

        } catch (error) {
            Alert.alert("Hata", "Mesaj gönderilemedi.");
        } finally {
            setSending(false);
        }
    };

    const closeRequest = async () => {
        Alert.alert(
            "Konuyu Kapat",
            "Bu talebi sonlandırmak istediğinize emin misiniz?",
            [
                { text: "Vazgeç", style: "cancel" },
                { text: "Kapat", style: 'destructive', onPress: async () => {
                    try {
                        let token = await AsyncStorage.getItem('userToken');
                        if (token) token = token.replace(/^"|"$/g, '');

                        await axios.post(`${API_URL}/api/talep/cevapla`, 
                            { talep_id: request.id, mesaj: '🔴 [SİSTEM]: Konu kapatıldı.', yeni_durum: 'KAPANDI' },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        setIsClosed(true);
                        fetchMessages();
                    } catch (e) { Alert.alert("Hata", "İşlem başarısız."); }
                }}
            ]
        );
    };

    const renderMessage = ({ item }) => {
        const isMe = item.taraf === 'me';
        const isSystem = item.mesaj.includes('[SİSTEM') || item.mesaj.includes('KAPATILDI');

        if (isSystem) {
            return (
                <View style={styles.systemMessageContainer}>
                    <Text style={styles.systemMessageText}>{item.mesaj}</Text>
                </View>
            );
        }

        return (
            <View style={[styles.bubbleContainer, isMe ? styles.rightContainer : styles.leftContainer]}>
                <View style={[styles.bubble, isMe ? styles.rightBubble : styles.leftBubble]}>
                    {!isMe && <Text style={styles.senderName}>{item.gorunen_isim}</Text>}
                    <Text style={[styles.messageText, isMe ? styles.rightText : styles.leftText]}>{item.mesaj}</Text>
                    
                    <View style={styles.timeContainer}>
                        <Text style={[styles.time, isMe ? styles.rightTime : styles.leftTime]}>
                            {moment(item.gonderim_tarihi).format('HH:mm')}
                        </Text>
                        {isMe && <Check size={12} color="#e5e5e5" style={{marginLeft: 4}} />}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={styles.header}>
                <View style={{flex: 1}}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{request.konu}</Text>
                    <Text style={styles.headerSub}>{request.gorunen_ad}</Text>
                </View>
                {!isClosed && (
                    <TouchableOpacity onPress={closeRequest} style={styles.closeBtn}>
                        <Archive size={20} color="#dc2626" />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {!isClosed ? (
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Mesaj yazın..."
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity 
                        style={[styles.sendButton, (!newMessage.trim() || sending) && styles.disabledButton]} 
                        onPress={sendMessage}
                        disabled={!newMessage.trim() || sending}
                    >
                        {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={20} color="#fff" />}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.closedFooter}>
                    <Archive size={18} color="#6b7280" style={{marginRight: 8}} />
                    <Text style={styles.closedText}>Bu konu kapatılmıştır.</Text>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ece5dd' }, 
    header: { padding: 15, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 3, shadowOpacity: 0.1, zIndex: 10 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
    headerSub: { fontSize: 12, color: '#6b7280' },
    closeBtn: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 },
    listContent: { padding: 15, paddingBottom: 20 },
    systemMessageContainer: { alignSelf: 'center', backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginVertical: 8, marginBottom: 15 },
    systemMessageText: { fontSize: 11, color: '#4b5563', fontStyle: 'italic' },
    bubbleContainer: { marginBottom: 10, width: '100%' },
    rightContainer: { alignItems: 'flex-end' },
    leftContainer: { alignItems: 'flex-start' },
    bubble: { maxWidth: '80%', padding: 10, borderRadius: 12, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
    rightBubble: { backgroundColor: '#dcf8c6', borderTopRightRadius: 0 },
    leftBubble: { backgroundColor: '#fff', borderTopLeftRadius: 0 },
    senderName: { fontSize: 11, fontWeight: 'bold', color: '#ea580c', marginBottom: 4 },
    messageText: { fontSize: 15, lineHeight: 20 },
    rightText: { color: '#111827' },
    leftText: { color: '#111827' },
    timeContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
    time: { fontSize: 10, color: '#6b7280' },
    rightTime: { color: '#6b7280' },
    inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e5e5' },
    input: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, maxHeight: 100, fontSize: 15 },
    sendButton: { backgroundColor: '#128c7e', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    disabledButton: { backgroundColor: '#9ca3af' },
    closedFooter: { padding: 20, backgroundColor: '#f3f4f6', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    closedText: { color: '#6b7280', fontWeight: 'bold', fontSize: 14 }
});