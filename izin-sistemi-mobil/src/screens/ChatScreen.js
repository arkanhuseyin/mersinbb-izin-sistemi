import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Send, Archive, CheckCheck, User } from 'lucide-react-native';
import moment from 'moment';
import 'moment/locale/tr'; 

import { API_URL } from '../config';

const COLORS = {
    bg: '#F0F2F5', 
    white: '#FFFFFF',
    primary: '#2563EB',
    myBubble: '#2563EB', 
    otherBubble: '#FFFFFF', 
    textDark: '#111827',
    textLight: '#6B7280'
};

export default function ChatScreen({ route, navigation }) {
    const { request } = route.params;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isClosed, setIsClosed] = useState(request.durum === 'KAPANDI');
    const [sending, setSending] = useState(false);
    
    const flatListRef = useRef();

    useEffect(() => {
        fetchMessages();
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
        } catch (error) { console.error(error); }
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        setSending(true);
        try {
            let token = await AsyncStorage.getItem('userToken');
            if (token) token = token.replace(/^"|"$/g, '');
            
            await axios.post(`${API_URL}/api/talep/cevapla`, 
                { talep_id: request.id, mesaj: newMessage, yeni_durum: null },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setNewMessage('');
            fetchMessages(); 
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (error) { Alert.alert("Hata", "Mesaj gönderilemedi."); } 
        finally { setSending(false); }
    };

    const closeRequest = async () => {
        Alert.alert("Konuyu Kapat", "Talebi sonlandırmak istiyor musunuz?", [
            { text: "Vazgeç", style: "cancel" },
            { text: "Kapat", style: 'destructive', onPress: async () => {
                try {
                    let token = await AsyncStorage.getItem('userToken');
                    if (token) token = token.replace(/^"|"$/g, '');
                    await axios.post(`${API_URL}/api/talep/cevapla`, 
                        { talep_id: request.id, mesaj: '🔴 Konu kapatıldı.', yeni_durum: 'KAPANDI' },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setIsClosed(true);
                    fetchMessages();
                } catch (e) { Alert.alert("Hata"); }
            }}
        ]);
    };

    const renderMessage = ({ item }) => {
        const isMe = item.taraf === 'me';
        const isSystem = item.mesaj.includes('🔴') || item.mesaj.includes('SİSTEM');

        if (isSystem) {
            return (
                <View style={styles.systemMsg}>
                    <Text style={styles.systemMsgText}>{item.mesaj}</Text>
                </View>
            );
        }

        return (
            <View style={[styles.bubbleContainer, isMe ? styles.rightContainer : styles.leftContainer]}>
                <View style={[styles.bubble, isMe ? styles.rightBubble : styles.leftBubble]}>
                    {!isMe && (
                        <View style={styles.senderHeader}>
                            <User size={12} color={COLORS.primary} style={{marginRight: 4}} />
                            <Text style={styles.senderName}>{item.gorunen_isim}</Text>
                        </View>
                    )}
                    
                    <Text style={[styles.messageText, isMe ? {color:'#fff'} : {color:COLORS.textDark}]}>
                        {item.mesaj}
                    </Text>
                    
                    <View style={styles.metaContainer}>
                        <Text style={[styles.time, isMe ? {color:'#BFDBFE'} : {color:COLORS.textLight}]}>
                            {moment(item.gonderim_tarihi).format('HH:mm')}
                        </Text>
                        {isMe && <CheckCheck size={14} color="#BFDBFE" style={{marginLeft: 4}} />}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            
            {/* HATA BURADAYDI: SafeAreaView'in içine KeyboardAvoidingView ekledik. 
               Böylece hem çentik (notch) sorunu olmaz hem de klavye düzgün çalışır.
            */}
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={{flex:1}}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{request.konu}</Text>
                        <Text style={styles.headerSub}>Talep No: #{request.id}</Text>
                    </View>
                    {!isClosed && (
                        <TouchableOpacity onPress={closeRequest} style={styles.actionBtn}>
                            <Archive size={20} color={COLORS.textLight} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Chat Alanı */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                {/* Input Alanı */}
                {!isClosed ? (
                    <View style={styles.inputWrapper}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Mesaj yazın..."
                                value={newMessage}
                                onChangeText={setNewMessage}
                                multiline
                                placeholderTextColor="#9CA3AF"
                            />
                            <TouchableOpacity 
                                style={[styles.sendButton, (!newMessage.trim()) && styles.sendButtonDisabled]} 
                                onPress={sendMessage}
                                disabled={!newMessage.trim() || sending}
                            >
                                {sending ? <ActivityIndicator color="#fff" size="small"/> : <Send size={20} color="#fff" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.closedFooter}>
                        <Archive size={18} color={COLORS.textLight} />
                        <Text style={styles.closedText}>Bu konu kapatılmıştır.</Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    
    // Header
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', elevation: 2 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
    headerSub: { fontSize: 12, color: COLORS.textLight },
    actionBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },

    // Liste
    listContent: { padding: 16, paddingBottom: 24 },
    systemMsg: { alignSelf: 'center', backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12 },
    systemMsgText: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },

    // Baloncuklar
    bubbleContainer: { marginBottom: 12, width: '100%' },
    rightContainer: { alignItems: 'flex-end' },
    leftContainer: { alignItems: 'flex-start' },
    
    bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    rightBubble: { backgroundColor: COLORS.myBubble, borderBottomRightRadius: 2 },
    leftBubble: { backgroundColor: COLORS.otherBubble, borderBottomLeftRadius: 2 },
    
    senderHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    senderName: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
    
    messageText: { fontSize: 15, lineHeight: 22 },
    
    metaContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
    time: { fontSize: 10 },

    // Input
    inputWrapper: { backgroundColor: '#fff', padding: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#F3F4F6', borderRadius: 24, padding: 4 },
    input: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 100, color: COLORS.textDark },
    sendButton: { width: 40, height: 40, backgroundColor: COLORS.primary, borderRadius: 20, alignItems: 'center', justifyContent: 'center', margin: 4 },
    sendButtonDisabled: { backgroundColor: '#9CA3AF' },

    closedFooter: { padding: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#F9FAFB' },
    closedText: { color: COLORS.textLight, fontWeight: '600' }
});