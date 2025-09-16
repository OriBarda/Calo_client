@@ .. @@
 import React from 'react';
 import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
 import { Camera, Image as ImageIcon } from 'lucide-react-native';
+import { LinearGradient } from 'expo-linear-gradient';
 import { useTheme } from '@/src/context/ThemeContext';
 import { useTranslation } from 'react-i18next';
 
@@ .. @@
   return (
     <View style={styles.container}>
-      <View style={[styles.iconContainer, { backgroundColor: colors.emerald500 + '15' }]}>
-        <Camera size={48} color={colors.emerald500} />
-      </View>
+      <LinearGradient
+        colors={[colors.emerald500 + '20', colors.emerald500 + '10']}
+        style={styles.iconContainer}
+      >
+        <View style={[styles.iconInner, { backgroundColor: colors.emerald500 }]}>
+          <Camera size={48} color="#FFFFFF" />
+        </View>
+      </LinearGradient>
       
       <Text style={[styles.title, { color: colors.text }]}>
         {t('camera.title') || 'Meal Scanner'}
@@ .. @@
       <View style={styles.buttons}>
         <TouchableOpacity
-          style={[styles.primaryButton, { backgroundColor: colors.emerald500 }]}
+          style={styles.primaryButton}
           onPress={onTakePhoto}
         >
-          <Camera size={20} color="#FFFFFF" />
-          <Text style={styles.primaryButtonText}>
-            {t('camera.takePhoto') || 'Take Photo'}
-          </Text>
+          <LinearGradient
+            colors={[colors.emerald500, colors.emerald600]}
+            style={styles.primaryButtonGradient}
+          >
+            <Camera size={20} color="#FFFFFF" />
+            <Text style={styles.primaryButtonText}>
+              {t('camera.takePhoto') || 'Take Photo'}
+            </Text>
+          </LinearGradient>
         </TouchableOpacity>
 
         <TouchableOpacity
@@ .. @@
   iconContainer: {
     width: 100,
     height: 100,
-    borderRadius: 50,
+    borderRadius: 50,
+    justifyContent: 'center',
+    alignItems: 'center',
+    marginBottom: 32,
+    shadowColor: '#000000',
+    shadowOffset: { width: 0, height: 8 },
+    shadowOpacity: 0.15,
+    shadowRadius: 16,
+    elevation: 8,
+  },
+  iconInner: {
+    width: 80,
+    height: 80,
+    borderRadius: 40,
     justifyContent: 'center',
     alignItems: 'center',
-    marginBottom: 32,
   },
   title: {
     fontSize: 28,
@@ .. @@
   },
   primaryButton: {
-    flexDirection: 'row',
-    alignItems: 'center',
-    justifyContent: 'center',
-    paddingVertical: 16,
-    paddingHorizontal: 24,
     borderRadius: 16,
-    gap: 12,
+    overflow: 'hidden',
     shadowColor: '#10B981',
     shadowOffset: { width: 0, height: 4 },
     shadowOpacity: 0.3,
     shadowRadius: 8,
     elevation: 4,
   },
+  primaryButtonGradient: {
+    flexDirection: 'row',
+    alignItems: 'center',
+    justifyContent: 'center',
+    paddingVertical: 16,
+    paddingHorizontal: 24,
+    gap: 12,
+  },
   primaryButtonText: {
     fontSize: 16,
     fontWeight: '600',