@@ .. @@
   const renderDeleteConfirmModal = () => (
     <Modal
       visible={showDeleteConfirm}
       animationType="fade"
       transparent={true}
       onRequestClose={() => setShowDeleteConfirm(false)}
     >
       <View style={styles.modalOverlay}>
         <View
           style={[styles.confirmModalContent, { backgroundColor: colors.card }]}
         >
           <AlertTriangle size={48} color="#EF4444" />
           <Text style={[styles.confirmTitle, { color: colors.text }]}>
             Delete Analysis
           </Text>
           <Text style={[styles.confirmMessage, { color: colors.icon }]}>
             Are you sure you want to delete this meal analysis?
           </Text>
 
           <View style={styles.confirmActions}>
             <TouchableOpacity
               style={[
                 styles.confirmCancelButton,
                 { backgroundColor: colors.surface, borderColor: colors.border },
               ]}
               onPress={() => setShowDeleteConfirm(false)}
             >
               <Text style={[styles.confirmCancelText, { color: colors.icon }]}>
                 Cancel
               </Text>
             </TouchableOpacity>
 
             <TouchableOpacity
               style={styles.confirmDeleteButton}
               onPress={confirmDeleteMeal}
             >
               <Text style={styles.confirmDeleteText}>Delete</Text>
             </TouchableOpacity>
           </View>
         </View>
       </View>
     </Modal>
   );
 
-  // Start continuous rotation animation for loading states
-  useEffect(() => {
-    const startRotation = () => {
-      Animated.loop(
-        Animated.timing(scaleAnim, {
-          toValue: 1,
-          duration: 2000,
-          useNativeDriver: true,
-        })
-      ).start();
-    };
-
-    if (isAnalyzing || isPosting || isUpdating) {
-      startRotation();
-    }
-  }, [isAnalyzing, isPosting, isUpdating, scaleAnim]);
+  // Enhanced animation effects
+  useEffect(() => {
+    if (isAnalyzing || isPosting || isUpdating) {
+      Animated.loop(
+        Animated.timing(scaleAnim, {
+          toValue: 1,
+          duration: 2000,
+          useNativeDriver: true,
+        })
+      ).start();
+    } else {
+      scaleAnim.setValue(0);
+    }
+  }, [isAnalyzing, isPosting, isUpdating, scaleAnim]);
 
   return (
     <SafeAreaView
@@ .. @@
       if (!visible) return null;
 
       return (
-        <Modal visible={visible} transparent animationType="fade">
-          <View style={styles.scanningOverlay}>
+        <Modal 
+          visible={visible} 
+          transparent 
+          animationType="fade"
+          statusBarTranslucent
+        >
+          <View style={[styles.scanningOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }]}>
             <View style={styles.scanningContainer}>
-              <View style={styles.scanningArea}>
-                <Animated.View
-                  style={[
-                    styles.scanningIcon,
-                    {
-                      transform: [
-                        {
-                          rotate: scaleAnim.interpolate({
-                            inputRange: [0, 1],
-                            outputRange: ["0deg", "360deg"],
-                          }),
-                        },
-                      ],
-                    },
-                  ]}
-                >
-                  <Sparkles size={48} color={colors.emerald500} />
-                </Animated.View>
+              {/* Enhanced scanning area with glassmorphism */}
+              <View style={[styles.scanningArea, { borderColor: colors.emerald500 }]}>
+                {/* Rotating outer ring */}
+                <Animated.View
+                  style={[
+                    styles.outerRing,
+                    {
+                      borderColor: colors.emerald500,
+                      transform: [
+                        {
+                          rotate: scaleAnim.interpolate({
+                            inputRange: [0, 1],
+                            outputRange: ["0deg", "360deg"],
+                          }),
+                        },
+                      ],
+                    },
+                  ]}
+                />
+
+                {/* Pulsing inner circle */}
+                <Animated.View
+                  style={[
+                    styles.innerCircle,
+                    {
+                      backgroundColor: colors.emerald500 + "20",
+                      transform: [
+                        {
+                          scale: scaleAnim.interpolate({
+                            inputRange: [0, 1],
+                            outputRange: [1, 1.1],
+                          }),
+                        },
+                      ],
+                    },
+                  ]}
+                >
+                  <Sparkles size={48} color={colors.emerald500} />
+                </Animated.View>
+
+                {/* Corner indicators */}
+                {[0, 1, 2, 3].map((corner) => (
+                  <View
+                    key={corner}
+                    style={[
+                      styles.corner,
+                      {
+                        borderColor: colors.emerald500,
+                        ...getCornerStyle(corner),
+                      },
+                    ]}
+                  />
+                ))}
+              </View>
 
-              <Text style={[styles.scanningTitle, { color: colors.text }]}>
-                Analyzing Your Meal
+              {/* Enhanced text content */}
+              <View style={styles.textContainer}>
+                <Text style={[styles.scanningTitle, { color: colors.text }]}>
+                  Analyzing Your Meal
+                </Text>
+                <Text style={[styles.scanningSubtitle, { color: colors.icon }]}>
+                  Our AI is identifying ingredients and calculating nutrition
+                </Text>
+              </View>
+
+              {/* Enhanced progress indicator */}
+              <View style={styles.progressContainer}>
+                <View style={styles.progressHeader}>
+                  <Text style={[styles.progressLabel, { color: colors.text }]}>
+                    {progress < 95 ? "Analyzing..." : "Almost Done!"}
+                  </Text>
+                  <Text style={[styles.progressPercent, { color: colors.emerald500 }]}>
+                    {Math.round(progress)}%
+                  </Text>
+                </View>
+                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
+                  <Animated.View
+                    style={[
+                      styles.progressBar,
+                      {
+                        backgroundColor: colors.emerald500,
+                        width: `${progress}%`,
+                      },
+                    ]}
+                  />
+                </View>
+              </View>
+            </View>
+          </View>
+        </Modal>
+      );
+    };
+
+    // Helper function for corner styles
+    const getCornerStyle = (corner: number) => {
+      const size = 30;
+      const thickness = 3;
+
+      switch (corner) {
+        case 0: // Top-left
+          return {
+            top: -thickness,
+            left: -thickness,
+            borderTopWidth: thickness,
+            borderLeftWidth: thickness,
+            width: size,
+            height: size,
+          };
+        case 1: // Top-right
+          return {
+            top: -thickness,
+            right: -thickness,
+            borderTopWidth: thickness,
+            borderRightWidth: thickness,
+            width: size,
+            height: size,
+          };
+        case 2: // Bottom-left
+          return {
+            bottom: -thickness,
+            left: -thickness,
+            borderBottomWidth: thickness,
+            borderLeftWidth: thickness,
+            width: size,
+            height: size,
+          };
+        case 3: // Bottom-right
+          return {
+            bottom: -thickness,
+            right: -thickness,
+            borderBottomWidth: thickness,
+            borderRightWidth: thickness,
+            width: size,
+            height: size,
+          };
+        default:
+          return {};
+      }
+    };
+
+    const styles = StyleSheet.create({
+      scanningOverlay: {
+        flex: 1,
+        justifyContent: 'center',
+        alignItems: 'center',
+      },
+      scanningContainer: {
+        alignItems: 'center',
+        justifyContent: 'center',
+        padding: 40,
+      },
+      scanningArea: {
+        width: 300,
+        height: 300,
+        borderRadius: 20,
+        borderWidth: 2,
+        justifyContent: 'center',
+        alignItems: 'center',
+        position: 'relative',
+        overflow: 'hidden',
+        marginBottom: 40,
+      },
+      outerRing: {
+        position: 'absolute',
+        width: 280,
+        height: 280,
+        borderRadius: 140,
+        borderWidth: 1,
+        borderStyle: 'dashed',
+      },
+      innerCircle: {
+        width: 120,
+        height: 120,
+        borderRadius: 60,
+        justifyContent: 'center',
+        alignItems: 'center',
+        zIndex: 2,
+      },
+      corner: {
+        position: 'absolute',
+        borderColor: 'transparent',
+      },
+      textContainer: {
+        alignItems: 'center',
+        marginBottom: 30,
+        paddingHorizontal: 40,
+      },
+      scanningTitle: {
+        fontSize: 24,
+        fontWeight: '700',
+        textAlign: 'center',
+        marginBottom: 8,
+      },
+      scanningSubtitle: {
+        fontSize: 16,
+        textAlign: 'center',
+        lineHeight: 24,
+      },
+      progressContainer: {
+        width: screenWidth - 80,
+        alignItems: 'center',
+      },
+      progressHeader: {
+        flexDirection: 'row',
+        justifyContent: 'space-between',
+        alignItems: 'center',
+        width: '100%',
+        marginBottom: 8,
+      },
+      progressLabel: {
+        fontSize: 14,
+        fontWeight: '600',
+      },
+      progressPercent: {
+        fontSize: 14,
+        fontWeight: '700',
+      },
+      progressTrack: {
+        height: 6,
+        width: '100%',
+        borderRadius: 3,
+        overflow: 'hidden',
+      },
+      progressBar: {
+        height: '100%',
+        borderRadius: 3,
+      },
+    });
+
+    return (
+      <Modal 
+        visible={visible} 
+        transparent 
+        animationType="fade"
+        statusBarTranslucent
+      >
+        <View style={[styles.scanningOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)' }]}>
+          <View style={styles.scanningContainer}>
+            {/* Enhanced scanning area */}
+            <View style={[styles.scanningArea, { borderColor: colors.emerald500 }]}>
+              {/* Rotating outer ring */}
+              <Animated.View
+                style={[
+                  styles.outerRing,
+                  {
+                    borderColor: colors.emerald500,
+                    transform: [
+                      {
+                        rotate: scaleAnim.interpolate({
+                          inputRange: [0, 1],
+                          outputRange: ["0deg", "360deg"],
+                        }),
+                      },
+                    ],
+                  },
+                ]}
+              />
+
+              {/* Pulsing inner circle */}
+              <Animated.View
+                style={[
+                  styles.innerCircle,
+                  {
+                    backgroundColor: colors.emerald500 + "20",
+                    transform: [
+                      {
+                        scale: scaleAnim.interpolate({
+                          inputRange: [0, 1],
+                          outputRange: [1, 1.1],
+                        }),
+                      },
+                    ],
+                  },
+                ]}
+              >
+                <Sparkles size={48} color={colors.emerald500} />
+              </Animated.View>
+
+              {/* Corner indicators */}
+              {[0, 1, 2, 3].map((corner) => (
+                <View
+                  key={corner}
+                  style={[
+                    styles.corner,
+                    {
+                      borderColor: colors.emerald500,
+                      ...getCornerStyle(corner),
+                    },
+                  ]}
+                />
+              ))}
+            </View>
+
+            {/* Text content */}
+            <View style={styles.textContainer}>
+              <Text style={[styles.scanningTitle, { color: colors.text }]}>
+                Analyzing Your Meal
               </Text>
-              <Text style={[styles.scanningSubtitle, { color: colors.icon }]}>
+              <Text style={[styles.scanningSubtitle, { color: colors.icon }]}>
                 Our AI is identifying ingredients and calculating nutrition
               </Text>
+            </View>
 
+            {/* Progress indicator */}
+            <View style={styles.progressContainer}>
+              <View style={styles.progressHeader}>
+                <Text style={[styles.progressLabel, { color: colors.text }]}>
+                  {progress < 95 ? "Analyzing..." : "Almost Done!"}
+                </Text>
+                <Text style={[styles.progressPercent, { color: colors.emerald500 }]}>
+                  {Math.round(progress)}%
+                </Text>
+              </View>
+              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
+                <Animated.View
+                  style={[
+                    styles.progressBar,
+                    {
+                      backgroundColor: colors.emerald500,
+                      width: `${progress}%`,
+                    },
+                  ]}
+                />
+              </View>
             </View>
           </View>
         </View>
       </Modal>
     );
   };