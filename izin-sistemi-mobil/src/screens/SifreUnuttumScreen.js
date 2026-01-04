import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';

export default function SifreUnuttumScreen({ navigation }) {
  const [tcNo, setTcNo] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [kimlikFoto, setKimlikFoto] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  // Fotoğraf Seçme Fonksiyonu
  const fotoSec = async () => {
    // İzin iste
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("İzin Gerekli", "Galeriye erişim izni vermeniz gerekiyor.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setKimlikFoto(result.assets[0]);
    }
  };

  // Kamera Açma Fonksiyonu
  const fotoCek = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("İzin Gerekli", "Kameraya erişim izni vermeniz gerekiyor.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setKimlikFoto(result.assets[0]);
    }
  };

  const talepGonder = async () => {
    if (!tcNo || !sifre || !sifreTekrar || !kimlikFoto) { 
        Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun ve kimlik fotoğrafınızı yükleyin."); 
        return; 
    }

    if (sifre !== sifreTekrar) {
        Alert.alert("Hata", "Şifreler uyuşmuyor.");
        return;
    }

    if (tcNo.length !== 11) {
        Alert.alert("Hata", "TC Kimlik No 11 haneli olmalıdır.");
        return;
    }

    setYukleniyor(true);
    try {
        const formData = new FormData();
        formData.append('tc_no', tcNo);
        formData.append('yeni_sifre', sifre);
        
        // Fotoğrafı FormData'ya ekle
        const filename = kimlikFoto.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('kimlik_foto', {
            uri: kimlikFoto.uri,
            name: filename,
            type: type,
        });

        // Backend'deki yeni rotaya istek atıyoruz (Rotayı backendde ayarladığınızdan emin olun)
        await axios.post(`${API_URL}/api/auth/sifre-talep`, formData, {
            headers: { 
                'Content-Type': 'multipart/form-data',
            }
        });

        Alert.alert("Başarılı", "Talebiniz iletildi. Kimliğiniz doğrulandıktan sonra şifreniz güncellenecektir.", [
            { text: "Tamam", onPress: () => navigation.goBack() }
        ]);

    } catch (error) {
        console.log(error);
        if (error.response && error.response.status === 404) {
            Alert.alert("Hata", "Bu TC numarasına ait personel bulunamadı.");
        } else {
            Alert.alert("Hata", "İşlem başarısız. Sunucu hatası.");
        }
    } finally {
        setYukleniyor(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
    <ScrollView contentContainerStyle={styles.container}>
      
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark-outline" size={50} color="#0d6efd" />
        </View>
        
        <Text style={styles.title}>Şifre Değişiklik Talebi</Text>
        
        <Text style={styles.desc}>
            Güvenliğiniz için kimliğinizi doğrulamamız gerekmektedir. 
            Lütfen kimliğinizin ön yüzünün fotoğrafını yükleyiniz.
        </Text>

        {/* TC NO */}
        <View style={styles.inputGroup}>
            <Text style={styles.label}>TC Kimlik No</Text>
            <TextInput 
                style={styles.input} 
                placeholder="11 Haneli TC Kimlik No" 
                placeholderTextColor="#999"
                value={tcNo} 
                onChangeText={setTcNo} 
                keyboardType="number-pad" 
                maxLength={11}
            />
        </View>

        {/* ŞİFRE ALANLARI */}
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Yeni Şifre</Text>
            <TextInput 
                style={styles.input} 
                placeholder="******" 
                value={sifre} 
                onChangeText={setSifre} 
                secureTextEntry
            />
        </View>
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
            <TextInput 
                style={styles.input} 
                placeholder="******" 
                value={sifreTekrar} 
                onChangeText={setSifreTekrar} 
                secureTextEntry
            />
        </View>

        {/* FOTOĞRAF ALANI */}
        <Text style={styles.label}>Kimlik Fotoğrafı</Text>
        <View style={styles.photoContainer}>
            {kimlikFoto ? (
                <View style={{alignItems:'center'}}>
                    <Image source={{ uri: kimlikFoto.uri }} style={styles.previewImage} />
                    <TouchableOpacity onPress={() => setKimlikFoto(null)} style={styles.removePhotoBtn}>
                        <Text style={{color:'red', fontSize:12}}>Kaldır</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.photoButtons}>
                    <TouchableOpacity style={styles.photoBtn} onPress={fotoCek}>
                        <Ionicons name="camera" size={24} color="#0d6efd" />
                        <Text style={styles.photoBtnText}>Kamera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoBtn} onPress={fotoSec}>
                        <Ionicons name="images" size={24} color="#0d6efd" />
                        <Text style={styles.photoBtnText}>Galeri</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>

        <TouchableOpacity 
            style={[styles.button, yukleniyor && {backgroundColor:'#ccc'}]} 
            onPress={talepGonder}
            disabled={yukleniyor}
        >
            {yukleniyor ? (
                <ActivityIndicator size="small" color="white" />
            ) : (
                <Text style={styles.buttonText}>Talebi Gönder</Text>
            )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f8f9fa', padding: 20 },
  backButton: { marginTop: 30, marginBottom: 10 },
  content: { alignItems: 'center' },
  iconContainer: { backgroundColor: '#e7f1ff', padding: 15, borderRadius: 50, marginBottom: 15 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  desc: { textAlign: 'center', color: '#666', marginBottom: 25, fontSize: 14, lineHeight: 20 },
  inputGroup: { width: '100%', marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5, alignSelf: 'flex-start' },
  input: { width: '100%', backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16 },
  
  photoContainer: { width: '100%', marginBottom: 25, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#0d6efd', borderRadius: 10, padding: 15, backgroundColor: '#fff' },
  photoButtons: { flexDirection: 'row', gap: 20 },
  photoBtn: { alignItems: 'center', padding: 10 },
  photoBtnText: { color: '#0d6efd', marginTop: 5, fontWeight: 'bold' },
  previewImage: { width: 200, height: 120, borderRadius: 5, resizeMode: 'cover' },
  removePhotoBtn: { marginTop: 5 },

  button: { width: '100%', backgroundColor: '#0d6efd', padding: 15, borderRadius: 10, alignItems: 'center', shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 3.84, elevation: 5 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});