import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/auth.store';

// Las 9 capitales de departamento de Bolivia
const BOLIVIAN_CITIES = [
  'Sucre',
  'La Paz',
  'Cochabamba',
  'Oruro',
  'Potosí',
  'Tarija',
  'Santa Cruz de la Sierra',
  'Trinidad',
  'Cobija',
];

interface PersonalData {
  full_name: string;
  ci_number: string;
  birth_place: string;
  birth_date: string;
}

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const PersonalDataScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { setPersonalData } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [ciNumber, setCiNumber] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);

  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onDateChange = (event: any, selectedDate?: Date) => {
    // En Android el picker es un diálogo que se cierra solo
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') return;
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const handleNext = () => {
    if (!fullName.trim() || !ciNumber.trim() || !birthPlace || !birthDate) {
      Alert.alert('Datos incompletos', 'Por favor completa todos los campos.');
      return;
    }

    const ciRegex = /^\d{7,8}$/;
    if (!ciRegex.test(ciNumber.replace(/\s/g, ''))) {
      Alert.alert('CI inválido', 'El número de CI debe tener 7 u 8 dígitos.');
      return;
    }

    setPersonalData({
      full_name: fullName.trim(),
      ci_number: ciNumber.trim(),
      birth_place: birthPlace,
      birth_date: formatDate(birthDate),
    });
    navigation.navigate('IDPhoto');
  };

  // Límites del calendario: entre hace 100 años y hoy
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 100, 0, 1);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Datos Personales</Text>
      <Text style={styles.subtitle}>
        Ingresa tus datos tal como aparecen en tu carnet de identidad.
      </Text>

      <Text style={styles.label}>Nombre completo</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Juan Carlos Pérez López"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text style={styles.label}>Número de CI</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 1234567"
        value={ciNumber}
        onChangeText={(v) => setCiNumber(v.replace(/\D/g, ''))}
        keyboardType="numeric"
        maxLength={8}
        returnKeyType="next"
      />

      <Text style={styles.label}>Lugar de nacimiento</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setCityModalVisible(true)}>
        <Text style={birthPlace ? styles.selectorText : styles.selectorPlaceholder}>
          {birthPlace || 'Selecciona una ciudad'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Fecha de nacimiento</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setShowDatePicker(true)}>
        <Text style={birthDate ? styles.selectorText : styles.selectorPlaceholder}>
          {birthDate ? formatDate(birthDate) : 'Selecciona la fecha'}
        </Text>
        <Text style={styles.chevron}>📅</Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={birthDate || new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={today}
          minimumDate={minDate}
          onChange={onDateChange}
        />
      )}

      {/* En iOS el spinner queda visible; mostramos botón para confirmar */}
      {showDatePicker && Platform.OS === 'ios' && (
        <TouchableOpacity
          style={styles.confirmDateBtn}
          onPress={() => setShowDatePicker(false)}
        >
          <Text style={styles.confirmDateText}>Confirmar fecha</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Siguiente: Foto del carnet →</Text>
      </TouchableOpacity>

      <View style={styles.steps}>
        <View style={[styles.stepDot, styles.stepActive]} />
        <View style={styles.stepDot} />
        <View style={styles.stepDot} />
      </View>

      {/* Modal selector de ciudades */}
      <Modal
        visible={cityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCityModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lugar de nacimiento</Text>
            {BOLIVIAN_CITIES.map((city) => (
              <TouchableOpacity
                key={city}
                style={styles.cityOption}
                onPress={() => {
                  setBirthPlace(city);
                  setCityModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.cityOptionText,
                    birthPlace === city && styles.cityOptionSelected,
                  ]}
                >
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 28,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  selector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  selectorPlaceholder: {
    fontSize: 15,
    color: '#999',
  },
  chevron: {
    fontSize: 14,
    color: '#666',
  },
  confirmDateBtn: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  confirmDateText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ddd',
  },
  stepActive: {
    backgroundColor: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  cityOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cityOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  cityOptionSelected: {
    color: '#007AFF',
    fontWeight: '700',
  },
});

export { PersonalDataScreen };
