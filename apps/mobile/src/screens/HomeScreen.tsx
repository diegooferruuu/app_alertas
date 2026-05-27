import React from 'react';
import { View, Text } from 'react-native';

export const HomeScreen: React.FC = () => {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
        Welcome to Emergency Alert App
      </Text>
    </View>
  );
};
