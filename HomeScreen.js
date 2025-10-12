import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native'; // Import for navigation
import { getAuth } from 'firebase/auth';
import { db } from './firebase'; // Import Firestore instance
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';

const HomeScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOperations, setFilteredOperations] = useState([]);
  const [shortcuts, setShortcuts] = useState([]);
  const navigation = useNavigation(); // For navigating to other screens

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    // Fetch existing shortcuts (operations) when the page loads
    fetchShortcuts();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Reset the search query and filtered operations when screen comes back into focus
      setSearchQuery('');
      setFilteredOperations([]);
    }, [])
  );

  const fetchShortcuts = async () => {
    if (user) {
      try {
        const querySnapshot = await getDocs(collection(db, 'users', user.uid, 'shortcuts'));
        const shortcuts = [];
        querySnapshot.forEach((doc) => {
          shortcuts.push(doc.data());
        });
        setShortcuts(shortcuts); // Set the fetched shortcuts to state
      } catch (error) {
        Alert.alert('Error', 'Failed to load shortcuts: ' + error.message);
      }
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);

    // Filter operations based on search query
    const operations = ['Calibaration of Rotameter', 'Calibaration of Venturimeter']; // Add more operations if necessary
    if (text.trim() === '') {
      setFilteredOperations([]); // Clear filtered operations when search is empty
    } else {
      const filtered = operations.filter((operation) =>
        operation.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredOperations(filtered); // Update filtered operations based on the search query
    }
  };

  const handleNavigate = async (operation) => {
    // Check if shortcut already exists before navigating
    if (user) {
      const q = query(
        collection(db, 'users', user.uid, 'shortcuts'),
        where('operation', '==', operation)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Shortcut doesn't exist, add it
        const shortcutData = { operation, createdAt: new Date() };

        // Save the new shortcut in Firestore
        await addDoc(collection(db, 'users', user.uid, 'shortcuts'), shortcutData);

        // Update the local state to reflect the added shortcut
        setShortcuts((prevShortcuts) => [...prevShortcuts, shortcutData]);

        Alert.alert('Success', 'Shortcut added!');
      }
    }

    // Navigate to the correct screen based on the operation
    if (operation === 'Calibaration of Rotameter') {
      navigation.navigate('Calibaration of Rotameter'); // Navigate to Addition Template
    } else if (operation === 'Calibaration of Venturimeter') {
      navigation.navigate('Calibaration of Venturimeter'); // Navigate to Volume Template
    }
  };

  return (
    <View style={styles.container}>
      

      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search experiment"
        value={searchQuery}
        onChangeText={handleSearch}
        // Optionally clear the search when clicked
        onFocus={() => setSearchQuery('')}  // Clear the search when the input is focused
      />

      {/* Display filtered operation results */}
      {filteredOperations.length > 0 && (
        <FlatList
          data={filteredOperations}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.operationItem}
              onPress={() => handleNavigate(item)}>
              <Text style={styles.operationText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Display saved shortcuts */}
      <View style={styles.shortcutsContainer}>
        <Text style={styles.shortcutsTitle}>Your Shortcuts:</Text>
        {shortcuts.length > 0 ? (
          <FlatList
            data={shortcuts}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <View style={styles.shortcutCard}>
                <Text style={styles.shortcutText}>{item.operation}</Text>
                <Button
                  title="Go"
                  onPress={() => handleNavigate(item.operation)}
                />
              </View>
            )}
          />
        ) : (
          <Text>No shortcuts saved.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  searchInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 18,
  },
  operationItem: {
    padding: 12,
    marginVertical: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
  },
  operationText: {
    fontSize: 18,
    color: '#333',
  },
  shortcutsContainer: {
    marginTop: 20, // Maintain the distance between search and shortcuts section
  },
  shortcutsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  shortcutCard: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  shortcutText: {
    fontSize: 18,
    color: '#333',
  },
});

export default HomeScreen;