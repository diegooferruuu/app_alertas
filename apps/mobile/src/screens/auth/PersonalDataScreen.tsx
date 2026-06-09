import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';

interface PersonalData {
  full_name: string;
  ci_number: string;
  birth_place: string;
  birth_date: string;
}

const PersonalDataScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { setPersonalData } = useAuthStore();
  const [form, setForm] = useState<PersonalData>({
    full_name: '',
    ci_number: '',
    birth_place: '',
    birth_date: '',
  });

  const handleChange = (field: keyof PersonalData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    const { full_name, ci_number, birth_place, birth_date } = form;

    if (!full_name.trim() || !ci_number.trim() || !birth_place.trim() || !birth_date.trim()) {
      Alert.alert('Datos incompletos', 'Por favor completa todos los campos.');
      return;
    }

    const ciRegex = /^\d{7,8}$/;
    if (!ciRegex.test(ci_number.replace(/\s/g, ''))) {
      Alert.alert('CI inválido', 'El número de CI debe tener 7 u 8 dígitos.');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birth_date)) {
      Alert.alert('Fecha inválida', 'Ingresa la fecha en formato YYYY-MM-DD (ej: 1995-03-21).');
      return;
    }

    setPersonalData(form);
    navigation.navigate('IDPhoto');
  };

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
        value={form.full_name}
        onChangeText={(v) => handleChange('full_name', v)}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text style={styles.label}>Número de CI</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 1234567"
        value={form.ci_number}
        onChangeText={(v) => handleChange('ci_number', v.replace(/\D/g, ''))}
        keyboardType="numeric"
        maxLength={8}
        returnKeyType="next"
      />

      <Text style={styles.label}>Lugar de nacimiento</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: La Paz"
        value={form.birth_place}
        onChangeText={(v) => handleChange('birth_place', v)}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text style={styles.label}>Fecha de nacimiento</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD (ej: 1995-03-21)"
        value={form.birth_date}
        onChangeText={(v) => handleChange('birth_date', v)}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        maxLength={10}
        returnKeyType="done"
      />

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Siguiente: Foto del carnet →</Text>
      </TouchableOpacity>

      <View style={styles.steps}>
        <View style={[styles.stepDot, styles.stepActive]} />
        <View style={styles.stepDot} />
        <View style={styles.stepDot} />
      </View>
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
});

export { PersonalDataScreen };
