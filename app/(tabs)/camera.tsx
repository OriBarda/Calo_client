import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/src/store";
import {
  analyzeMeal,
  postMeal,
  clearPendingMeal,
  clearError,
} from "@/src/store/mealSlice";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/src/i18n/context/LanguageContext";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import {
  Edit3,
  AlertTriangle,
  X,
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Save,
  RefreshCw,
  Trash2,
  Plus,
} from "lucide-react-native";
import { useMealDataRefresh } from "@/hooks/useMealDataRefresh";
import { useTheme } from "@/src/context/ThemeContext";
import { LinearGradient } from "expo-linear-gradient";
import {
  MealTypeSelector,
  MealType,
} from "@/components/camera/MealTypeSelector";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface Ingredient {
  name: string;
  calories: number;
  protein_g?: number;
  protein?: number;
  carbs_g?: number;
  carbs?: number;
  fats_g?: number;
  fat?: number;
  fats?: number;
  fiber_g?: number;
  fiber?: number;
  sugar_g?: number;
  sugar?: number;
  sodium_mg?: number;
  sodium?: number;
  estimated_portion_g?: number;
}

interface AnalysisData {
  name?: string;
  meal_name?: string;
  description?: string;
  calories: number;
  protein_g?: number;
  protein?: number;
  carbs_g?: number;
  carbs?: number;
  fats_g?: number;
  fat?: number;
  fats?: number;
  fiber_g?: number;
  fiber?: number;
  sugar_g?: number;
  sugar?: number;
  sodium_mg?: number;
  sodium?: number;
  saturated_fats_g?: number;
  polyunsaturated_fats_g?: number;
  monounsaturated_fats_g?: number;
  omega_3_g?: number;
  omega_6_g?: number;
  cholesterol_mg?: number;
  serving_size_g?: number;
  ingredients?: Ingredient[];
  healthScore?: string;
  recommendations?: string;
  cookingMethod?: string;
  cooking_method?: string;
  food_category?: string;
  confidence?: number;
  servingSize?: string;
  healthNotes?: string;
}

// Enhanced Image Optimization Function
const optimizeImageForUpload = async (
  imageUri: string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: "jpeg" | "png";
  } = {}
): Promise<string> => {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.8,
    format = "jpeg",
  } = options;

  try {
    console.log("🖼️ Optimizing image...");

    if (!imageUri || imageUri.trim() === "") {
      throw new Error("Invalid image URI provided");
    }

    const manipulatorFormat =
      format === "jpeg"
        ? ImageManipulator.SaveFormat.JPEG
        : ImageManipulator.SaveFormat.PNG;

    const manipulatedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight,
          },
        },
      ],
      {
        compress: quality,
        format: manipulatorFormat,
        base64: true,
      }
    );

    const base64Result = manipulatedImage.base64;
    if (!base64Result || base64Result.length < 1000) {
      throw new Error("Image optimization produced invalid result");
    }

    console.log("✅ Image optimized successfully");
    return base64Result;
  } catch (error) {
    console.error("💥 Image optimization failed:", error);
    throw new Error(
      `Failed to optimize image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

// Enhanced Storage Check Function
const checkStorageBeforeOperation = async (): Promise<boolean> => {
  try {
    const { StorageCleanupService } = await import(
      "@/src/utils/storageCleanup"
    );
    return await StorageCleanupService.checkStorageBeforeOperation();
  } catch (error) {
    console.warn("Storage check failed:", error);
    return false;
  }
};

export default function CameraScreen() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const { refreshAllMealData, refreshMealData, immediateRefresh } =
    useMealDataRefresh();
  const { colors, isDark } = useTheme();

  const { pendingMeal, isAnalyzing, isPosting, isUpdating, error } =
    useSelector((state: RootState) => state.meal);

  // Local state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [userComment, setUserComment] = useState("");
  const [editedIngredients, setEditedIngredients] = useState<Ingredient[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(
    null
  );
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [hasBeenAnalyzed, setHasBeenAnalyzed] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showScanAnimation, setShowScanAnimation] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(
    null
  );
  const [showMealTypeSelector, setShowMealTypeSelector] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const nutritionCardAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);

  // Request camera permission on mount
  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
      } catch (error) {
        console.error("Permission request error:", error);
        setHasPermission(false);
      }
    };
    requestCameraPermission();
  }, []);

  // Clear error on mount
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Update local state when pendingMeal changes
  useEffect(() => {
    if (pendingMeal?.analysis) {
      setAnalysisData(pendingMeal.analysis);
      const ingredients = pendingMeal.analysis.ingredients || [];
      setEditedIngredients(ingredients);
      setHasBeenAnalyzed(true);
      setShowResults(true);

      if (pendingMeal.image_base_64) {
        const imageUri = pendingMeal.image_base_64.startsWith("data:")
          ? pendingMeal.image_base_64
          : `data:image/jpeg;base64,${pendingMeal.image_base_64}`;
        setSelectedImage(imageUri);
      }

      // Enhanced entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(nutritionCardAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }
  }, [pendingMeal, fadeAnim, slideAnim, nutritionCardAnim]);

  // Helper function to get nutrition value with fallbacks
  const getNutritionValue = (
    data: AnalysisData | Ingredient | undefined,
    field: string
  ): number => {
    if (!data) return 0;

    const variations = [
      field,
      field.replace("_g", ""),
      field.replace("_mg", ""),
      field.replace("g", ""),
      field.replace("mg", ""),
    ];

    for (const variation of variations) {
      const value = data[variation as keyof typeof data];
      if (typeof value === "number" && value > 0) {
        return Math.round(value);
      }
      if (typeof value === "string" && !isNaN(parseFloat(value))) {
        return Math.round(parseFloat(value));
      }
    }
    return 0;
  };

  // Helper function to get meal name
  const getMealName = (data: AnalysisData): string => {
    return data?.name || data?.meal_name || "Analyzed Meal";
  };

  // Enhanced image selection handlers
  const handleTakePhoto = async () => {
    if (!selectedMealType) {
      Alert.alert(
        "Select Meal Type",
        "Please select a meal type before taking a photo"
      );
      return;
    }

    if (hasPermission === null) {
      Alert.alert(
        t("common.error"),
        "Camera permission is still being checked."
      );
      return;
    }
    if (!hasPermission) {
      Alert.alert(
        t("camera.permission"),
        "Camera permission is required to take photos. Please grant permission in settings."
      );
      return;
    }

    // Check storage before taking photo
    const storageOk = await checkStorageBeforeOperation();
    if (!storageOk) {
      Alert.alert(
        "Storage Full",
        "Device storage is full. Please free up space and try again."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        resetAnalysisState();
        setShowResults(false);
        setShowMealTypeSelector(false);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert(t("common.error"), "Failed to take photo");
    }
  };

  const handleSelectFromGallery = async () => {
    if (!selectedMealType) {
      Alert.alert(
        "Select Meal Type",
        "Please select a meal type before selecting from gallery"
      );
      return;
    }

    // Check storage before selecting from gallery
    const storageOk = await checkStorageBeforeOperation();
    if (!storageOk) {
      Alert.alert(
        "Storage Full",
        "Device storage is full. Please free up space and try again."
      );
      return;
    }

    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("camera.permission"),
          "Gallery permission is required to select photos"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        resetAnalysisState();
        setShowResults(false);
        setShowMealTypeSelector(false);
      }
    } catch (error) {
      console.error("Gallery error:", error);
      Alert.alert(t("common.error"), "Failed to select image");
    }
  };

  // Reset analysis state when new image is selected or analysis is discarded
  const resetAnalysisState = () => {
    setAnalysisData(null);
    setEditedIngredients([]);
    setUserComment("");
    setHasBeenAnalyzed(false);
    dispatch(clearPendingMeal());
    dispatch(clearError());

    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    nutritionCardAnim.setValue(0);
  };

  // Enhanced image processing function
  const processImage = async (imageUri: string): Promise<string | null> => {
    try {
      console.log("Processing image:", imageUri);

      if (!imageUri || imageUri.trim() === "") {
        console.error("Invalid image URI provided");
        return null;
      }

      // Use the local optimization function
      const optimizedBase64 = await optimizeImageForUpload(imageUri, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
        format: "jpeg",
      });

      if (!optimizedBase64 || optimizedBase64.length < 100) {
        console.error("Failed to optimize image or result too small");
        return null;
      }

      // Validate base64 format
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(optimizedBase64)) {
        console.error("Invalid base64 format generated");
        return null;
      }

      // Check size limit (10MB base64 ≈ 7.5MB binary)
      if (optimizedBase64.length > 10 * 1024 * 1024) {
        console.error("Optimized image still too large");
        return null;
      }

      console.log(
        "Image processed successfully, base64 length:",
        optimizedBase64.length
      );
      return optimizedBase64;
    } catch (error) {
      console.error("Error processing image:", error);
      return null;
    }
  };

  // Initial analysis
  const handleAnalyzeImage = async () => {
    if (!selectedImage) {
      Alert.alert(t("common.error"), "Please select an image first");
      return;
    }
    if (!selectedMealType) {
      Alert.alert(t("common.error"), "Please select a meal type first");
      return;
    }

    // Enhanced storage check
    const storageOk = await checkStorageBeforeOperation();
    if (!storageOk) {
      Alert.alert(
        "Storage Full",
        "Device storage is full. Please free up space and try again."
      );
      return;
    }

    // Show scanning animation with progress
    setShowScanAnimation(true);
    setAnalysisProgress(0);

    // Simulate progress during analysis
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => Math.min(prev + 10, 90));
    }, 1000);

    try {
      const base64Image = await processImage(selectedImage);
      if (!base64Image) {
        clearInterval(progressInterval);
        setShowScanAnimation(false);
        Alert.alert(t("common.error"), "Could not process image.");
        return;
      }

      const analysisParams = {
        imageBase64: base64Image,
        language: isRTL ? "hebrew" : "english",
        updateText:
          userComment.trim() || "Please provide detailed nutritional analysis.",
      };

      console.log("🚀 Starting analysis with params:", {
        hasImage: !!analysisParams.imageBase64,
        language: analysisParams.language,
      });

      const result = await dispatch(analyzeMeal(analysisParams));

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      if (analyzeMeal.fulfilled.match(result)) {
        console.log("✅ Analysis successful:", result.payload);
        setTimeout(() => {
          setShowScanAnimation(false);
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 500);
      } else {
        setShowScanAnimation(false);
        const errorMessage =
          result.payload ||
          "Failed to analyze meal. Please check your connection and try again.";
        console.error("❌ Analysis failed:", errorMessage);
        Alert.alert(
          t("camera.analysis_failed"),
          typeof errorMessage === "string"
            ? errorMessage
            : "Analysis failed. Please try again."
        );
      }
    } catch (error) {
      clearInterval(progressInterval);
      setShowScanAnimation(false);
      console.error("💥 Analysis error:", error);

      let errorMessage = "Analysis failed";
      if (error instanceof Error) {
        if (error.message.includes("Network")) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (error.message.includes("timeout")) {
          errorMessage =
            "Analysis timed out. Please try again with a clearer image.";
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert(t("camera.analysis_failed"), errorMessage);
    }
  };

  // Re-analysis after edits
  const handleReAnalyze = async () => {
    if (!selectedImage || !hasBeenAnalyzed) {
      Alert.alert(t("common.error"), "No meal to re-analyze");
      return;
    }
    if (!selectedMealType) {
      Alert.alert(t("common.error"), "Please select a meal type first");
      return;
    }

    // Check storage before re-analysis
    const storageOk = await checkStorageBeforeOperation();
    if (!storageOk) {
      Alert.alert(
        "Storage Full",
        "Device storage is full. Please free up space and try again."
      );
      return;
    }

    setShowScanAnimation(true);

    try {
      await immediateRefresh();

      const base64Image = await processImage(selectedImage);
      if (!base64Image) {
        setShowScanAnimation(false);
        Alert.alert(
          t("common.error") || "Error",
          "Could not process image for re-analysis."
        );
        return;
      }

      let updateText = userComment.trim();
      if (editedIngredients.length > 0) {
        const ingredientsList = editedIngredients
          .map((ing) => ing.name)
          .join(", ");
        updateText +=
          (updateText ? " " : "") +
          `Please re-analyze considering these ingredients: ${ingredientsList}. Provide updated nutritional information.`;
      }
      if (!updateText) {
        updateText =
          "Please re-analyze this meal with updated nutritional information.";
      }

      const reAnalysisParams = {
        imageBase64: base64Image,
        language: isRTL ? "hebrew" : "english",
        updateText: updateText,
      };

      console.log("🔄 Starting re-analysis...");
      const result = await dispatch(analyzeMeal(reAnalysisParams)).unwrap();

      console.log("Re-analysis completed:", result);

      setAnalysisData(result.analysis);
      setEditedIngredients(result.analysis?.ingredients || []);
      setHasBeenAnalyzed(true);

      await refreshAllMealData();
      setShowScanAnimation(false);

      console.log("✅ Re-analysis and cache refresh completed");

      Alert.alert(
        t("common.success") || "Success",
        t("camera.reAnalysisSuccess") || "Meal re-analyzed successfully!"
      );
    } catch (error) {
      setShowScanAnimation(false);
      console.error("❌ Re-analysis error:", error);
      Alert.alert(
        t("common.error") || "Error",
        error instanceof Error ? error.message : "Re-analysis failed"
      );
    }
  };

  // Save meal to database
  const handleSaveMeal = async () => {
    if (!analysisData) {
      Alert.alert(t("common.error"), "No analysis data to save");
      return;
    }
    if (!selectedMealType) {
      Alert.alert(t("common.error"), "Please select a meal type to save");
      return;
    }

    // Check storage before saving
    const storageOk = await checkStorageBeforeOperation();
    if (!storageOk) {
      Alert.alert(
        "Storage Full",
        "Device storage is full. Please free up space and try again."
      );
      return;
    }

    try {
      const result = await dispatch(postMeal());

      if (postMeal.fulfilled.match(result)) {
        await refreshAllMealData();

        Alert.alert(t("camera.save_success"), "Meal saved successfully!", [
          {
            text: t("common.ok"),
            onPress: () => {
              resetAnalysisState();
              setSelectedImage(null);
              setShowResults(false);
              setSelectedMealType(null);
              setShowMealTypeSelector(true);
            },
          },
        ]);
      } else {
        Alert.alert(
          t("camera.save_failed"),
          typeof result.payload === "string"
            ? result.payload
            : "Failed to save meal. Please try again."
        );
      }
    } catch (error) {
      Alert.alert(
        t("camera.save_failed"),
        error instanceof Error ? error.message : "Save failed"
      );
    }
  };

  // Discard analysis
  const handleDeleteMeal = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteMeal = () => {
    resetAnalysisState();
    setSelectedImage(null);
    setShowDeleteConfirm(false);
    setShowResults(false);
    setSelectedMealType(null);
    setShowMealTypeSelector(true);
    Alert.alert(t("common.success"), "Meal analysis discarded successfully");
  };

  // Ingredient editing functions
  const handleEditIngredient = (ingredient: Ingredient, index: number) => {
    setEditingIngredient({ ...ingredient });
    setEditingIndex(index);
    setShowEditModal(true);
  };

  const handleAddIngredient = () => {
    const newIngredient: Ingredient = {
      name: "",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium_mg: 0,
    };
    setEditingIngredient(newIngredient);
    setEditingIndex(-1);
    setShowEditModal(true);
  };

  const handleRemoveIngredient = (index: number) => {
    const updatedIngredients = editedIngredients.filter((_, i) => i !== index);
    setEditedIngredients(updatedIngredients);
  };

  const handleSaveIngredient = () => {
    if (!editingIngredient || !editingIngredient.name.trim()) {
      Alert.alert(t("common.error"), "Ingredient name is required");
      return;
    }

    const updatedIngredients = [...editedIngredients];

    if (editingIndex >= 0) {
      updatedIngredients[editingIndex] = editingIngredient;
    } else {
      updatedIngredients.push(editingIngredient);
    }

    setEditedIngredients(updatedIngredients);
    setShowEditModal(false);
    setEditingIngredient(null);
    setEditingIndex(-1);
  };

  // Calculate total nutrition from current data
  const calculateTotalNutrition = () => {
    const currentIngredients =
      editedIngredients.length > 0
        ? editedIngredients
        : analysisData?.ingredients || [];

    if (!analysisData && currentIngredients.length === 0) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      };
    }

    const totalCalories = analysisData?.calories || 0;
    const totalProtein = analysisData
      ? getNutritionValue(analysisData, "protein_g") ||
        getNutritionValue(analysisData, "protein") ||
        0
      : 0;
    const totalCarbs = analysisData
      ? getNutritionValue(analysisData, "carbs_g") ||
        getNutritionValue(analysisData, "carbs") ||
        0
      : 0;
    const totalFat = analysisData
      ? getNutritionValue(analysisData, "fats_g") ||
        getNutritionValue(analysisData, "fat") ||
        0
      : 0;
    const totalFiber = analysisData
      ? getNutritionValue(analysisData, "fiber_g") ||
        getNutritionValue(analysisData, "fiber") ||
        0
      : 0;
    const totalSugar = analysisData
      ? getNutritionValue(analysisData, "sugar_g") ||
        getNutritionValue(analysisData, "sugar") ||
        0
      : 0;
    const totalSodium = analysisData
      ? getNutritionValue(analysisData, "sodium_mg") ||
        getNutritionValue(analysisData, "sodium") ||
        0
      : 0;

    return {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      fiber: totalFiber,
      sugar: totalSugar,
      sodium: totalSodium,
    };
  };

  // Enhanced Nutrition Overview Component
  const NutritionOverview = ({ nutrition, mealName }: any) => (
    <Animated.View
      style={[
        styles.nutritionCard,
        { backgroundColor: colors.card, opacity: nutritionCardAnim },
      ]}
    >
      <LinearGradient
        colors={[colors.emerald500, colors.emerald600]}
        style={styles.nutritionHeader}
      >
        <View style={styles.nutritionHeaderContent}>
          <Text style={styles.nutritionTitle}>{mealName}</Text>
          <Text style={styles.nutritionDate}>
            {new Date().toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.caloriesBadge}>
          <Text style={styles.caloriesValue}>{nutrition.calories}</Text>
          <Text style={styles.caloriesLabel}>kcal</Text>
        </View>
      </LinearGradient>

      <View style={styles.macroGrid}>
        <View style={styles.macroItem}>
          <View style={[styles.macroIcon, { backgroundColor: "#3b82f615" }]}>
            <Text style={styles.macroEmoji}>💪</Text>
          </View>
          <Text style={[styles.macroValue, { color: colors.text }]}>
            {nutrition.protein}g
          </Text>
          <Text style={[styles.macroLabel, { color: colors.icon }]}>
            Protein
          </Text>
        </View>

        <View style={styles.macroItem}>
          <View style={[styles.macroIcon, { backgroundColor: "#f59e0b15" }]}>
            <Text style={styles.macroEmoji}>🌾</Text>
          </View>
          <Text style={[styles.macroValue, { color: colors.text }]}>
            {nutrition.carbs}g
          </Text>
          <Text style={[styles.macroLabel, { color: colors.icon }]}>Carbs</Text>
        </View>

        <View style={styles.macroItem}>
          <View style={[styles.macroIcon, { backgroundColor: "#ef444415" }]}>
            <Text style={styles.macroEmoji}>🥑</Text>
          </View>
          <Text style={[styles.macroValue, { color: colors.text }]}>
            {nutrition.fat}g
          </Text>
          <Text style={[styles.macroLabel, { color: colors.icon }]}>Fat</Text>
        </View>
      </View>
    </Animated.View>
  );

  // Enhanced Action Buttons Component
  const ActionButtons = ({ onDelete, onReAnalyze, onSave }: any) => (
    <View style={styles.actionButtonsContainer}>
      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.emerald500 }]}
        onPress={onSave}
        disabled={isPosting}
      >
        <LinearGradient
          colors={[colors.emerald500, colors.emerald600]}
          style={styles.buttonGradient}
        >
          {isPosting ? (
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
              }}
            >
              <Sparkles size={20} color="#FFFFFF" />
            </Animated.View>
          ) : (
            <Save size={20} color="#FFFFFF" />
          )}
          <Text style={styles.saveButtonText}>
            {isPosting ? "Saving..." : "Save Meal"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.secondaryActions}>
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            { backgroundColor: colors.background, borderColor: "#EF4444" },
          ]}
          onPress={onDelete}
        >
          <Trash2 size={18} color="#EF4444" />
          <Text style={[styles.secondaryButtonText, { color: "#EF4444" }]}>
            Delete
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            {
              backgroundColor: colors.background,
              borderColor: colors.emerald500,
              opacity: isUpdating ? 0.6 : 1,
            },
          ]}
          onPress={onReAnalyze}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
              }}
            >
              <RefreshCw size={18} color={colors.emerald500} />
            </Animated.View>
          ) : (
            <RefreshCw size={18} color={colors.emerald500} />
          )}
          <Text
            style={[
              styles.secondaryButtonText,
              { color: colors.emerald500 },
            ]}
          >
            {isUpdating ? "Updating..." : "Re-analyze"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Enhanced Ingredients List Component
  const IngredientsList = ({ ingredients, onEditIngredient, onAddIngredient, onRemoveIngredient }: any) => {
    if (ingredients.length === 0) return null;

    return (
      <View style={[styles.ingredientsCard, { backgroundColor: colors.card }]}>
        <View style={styles.ingredientsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Ingredients ({ingredients.length})
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.emerald500 }]}
            onPress={onAddIngredient}
          >
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {ingredients.map((ingredient: Ingredient, index: number) => (
          <View
            key={index}
            style={[
              styles.ingredientRow,
              { borderBottomColor: colors.border },
            ]}
          >
            <View style={styles.ingredientInfo}>
              <Text style={[styles.ingredientName, { color: colors.text }]}>
                {typeof ingredient === "string" ? ingredient : ingredient.name}
              </Text>
              {typeof ingredient !== "string" && (
                <Text
                  style={[styles.ingredientNutrition, { color: colors.icon }]}
                >
                  {getNutritionValue(ingredient, "calories")} cal •{" "}
                  {getNutritionValue(ingredient, "protein")}g protein
                </Text>
              )}
            </View>

            <View style={styles.ingredientActions}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.emerald500 },
                ]}
                onPress={() => onEditIngredient(ingredient, index)}
              >
                <Edit3 size={16} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#EF4444" }]}
                onPress={() => onRemoveIngredient(index)}
              >
                <Trash2 size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Enhanced Image Selector Component
  const ImageSelector = ({ onTakePhoto, onSelectFromGallery }: any) => (
    <View style={styles.imageSelectorContainer}>
      <LinearGradient
        colors={[colors.emerald50, colors.background]}
        style={styles.imageSelectorGradient}
      >
        <View style={styles.imageSelectorContent}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.emerald500 + "15" },
            ]}
          >
            <Camera size={48} color={colors.emerald500} />
          </View>

          <Text style={[styles.selectorTitle, { color: colors.text }]}>
            Meal Scanner
          </Text>

          <Text style={[styles.selectorSubtitle, { color: colors.icon }]}>
            Take a photo or select from gallery to analyze your meal
          </Text>

          <View style={styles.selectorButtons}>
            <TouchableOpacity
              style={[
                styles.primarySelectorButton,
                { backgroundColor: colors.emerald500 },
              ]}
              onPress={onTakePhoto}
            >
              <LinearGradient
                colors={[colors.emerald500, colors.emerald600]}
                style={styles.buttonGradient}
              >
                <Camera size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Take Photo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondarySelectorButton,
                { borderColor: colors.emerald500 },
              ]}
              onPress={onSelectFromGallery}
            >
              <ImageIcon size={20} color={colors.emerald500} />
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: colors.emerald500 },
                ]}
              >
                Choose from Gallery
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  // Enhanced Selected Image Component
  const SelectedImage = ({
    imageUri,
    userComment,
    isAnalyzing,
    hasBeenAnalyzed,
    onRemoveImage,
    onRetakePhoto,
    onAnalyze,
    onCommentChange,
  }: any) => (
    <Animated.View
      style={[
        styles.selectedImageContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.imageHeader, { backgroundColor: colors.surface }]}>
        <Text style={[styles.imageHeaderTitle, { color: colors.text }]}>
          Image Preview
        </Text>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.background }]}
          onPress={onRemoveImage}
        >
          <X size={20} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <View style={styles.imageWrapper}>
        <View style={[styles.imageContainer, { backgroundColor: colors.border }]}>
          <img
            src={imageUri}
            style={styles.image}
            alt="Selected meal"
            onError={(e) => {
              console.error("Image load error:", e);
            }}
          />

          {isAnalyzing && (
            <View style={styles.analysisOverlay}>
              <View
                style={[
                  styles.analysisIndicator,
                  { backgroundColor: colors.emerald500 + "90" },
                ]}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: scaleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  }}
                >
                  <Sparkles size={24} color="#FFFFFF" />
                </Animated.View>
                <Text style={styles.analysisText}>Analyzing...</Text>
              </View>
            </View>
          )}

          {hasBeenAnalyzed && !isAnalyzing && (
            <View style={styles.successIndicator}>
              <View
                style={[
                  styles.successBadge,
                  { backgroundColor: colors.emerald500 },
                ]}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.successText}>✓</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.imageActions}>
          <TouchableOpacity
            style={[
              styles.imageActionButton,
              { backgroundColor: colors.surface + "E6" },
            ]}
            onPress={onRetakePhoto}
          >
            <Camera size={18} color={colors.icon} />
            <Text style={[styles.imageActionText, { color: colors.icon }]}>
              Retake
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.commentSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.commentLabel, { color: colors.text }]}>
          Add Details (Optional)
        </Text>
        <TextInput
          style={[
            styles.commentInput,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={userComment}
          onChangeText={onCommentChange}
          placeholder="Add any details about your meal..."
          placeholderTextColor={colors.icon}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {!hasBeenAnalyzed && (
        <TouchableOpacity
          style={[
            styles.analyzeButton,
            { opacity: isAnalyzing ? 0.6 : 1 },
          ]}
          onPress={onAnalyze}
          disabled={isAnalyzing}
        >
          <LinearGradient
            colors={[colors.emerald500, colors.emerald600]}
            style={styles.buttonGradient}
          >
            <Sparkles size={24} color="#FFFFFF" />
            <Text style={styles.analyzeButtonText}>
              {isAnalyzing ? "Analyzing..." : "Analyze Meal"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // Enhanced Scanning Animation Component
  const ScanningAnimation = ({ visible, onComplete, progress }: any) => {
    if (!visible) return null;

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.scanningOverlay}>
          <View style={styles.scanningContainer}>
            <View style={styles.scanningArea}>
              <Animated.View
                style={[
                  styles.scanningIcon,
                  {
                    transform: [
                      {
                        rotate: scaleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Sparkles size={48} color={colors.emerald500} />
              </Animated.View>

              <Text style={[styles.scanningTitle, { color: colors.text }]}>
                Analyzing Your Meal
              </Text>
              <Text style={[styles.scanningSubtitle, { color: colors.icon }]}>
                Our AI is identifying ingredients and calculating nutrition
              </Text>

              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        backgroundColor: colors.emerald500,
                        width: `${progress}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: colors.text }]}>
                  {progress}% Complete
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAnalysisResults = () => {
    if (!analysisData) return null;

    const totalNutrition = calculateTotalNutrition();

    return (
      <Animated.View
        style={[
          styles.resultsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View
          style={[styles.resultsHeader, { backgroundColor: colors.background }]}
        >
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface }]}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.resultsTitle, { color: colors.text }]}>
            {getMealName(analysisData)}
          </Text>
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: colors.emerald500 }]}
          >
            <View
              style={[styles.menuDot, { backgroundColor: colors.background }]}
            />
            <View
              style={[styles.menuDot, { backgroundColor: colors.background }]}
            />
            <View
              style={[styles.menuDot, { backgroundColor: colors.background }]}
            />
          </TouchableOpacity>
        </View>

        <NutritionOverview
          nutrition={totalNutrition}
          mealName={getMealName(analysisData)}
        />

        <ActionButtons
          onDelete={handleDeleteMeal}
          onReAnalyze={handleReAnalyze}
          onSave={handleSaveMeal}
        />

        <IngredientsList
          ingredients={
            editedIngredients.length > 0
              ? editedIngredients
              : analysisData.ingredients || []
          }
          onEditIngredient={handleEditIngredient}
          onRemoveIngredient={handleRemoveIngredient}
          onAddIngredient={handleAddIngredient}
        />

        {analysisData.recommendations && (
          <View
            style={[
              styles.healthInsights,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Health Insights
            </Text>
            <View
              style={[
                styles.insightCard,
                { backgroundColor: colors.emerald500 + "10" },
              ]}
            >
              <Sparkles size={20} color={colors.emerald500} />
              <Text style={[styles.insightText, { color: colors.text }]}>
                {analysisData.recommendations}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowEditModal(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingIndex >= 0 ? "Edit" : "Add"} Ingredient
            </Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <X size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Name *
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={editingIngredient?.name || ""}
                onChangeText={(text) =>
                  setEditingIngredient((prev) =>
                    prev ? { ...prev, name: text } : null
                  )
                }
                placeholder="Enter ingredient name"
                placeholderTextColor={colors.icon}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Calories
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.calories?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, calories: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.icon}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Protein (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.protein?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, protein: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.icon}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Carbs (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.carbs?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, carbs: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.icon}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  Fat (g)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editingIngredient?.fat?.toString() || "0"}
                  onChangeText={(text) =>
                    setEditingIngredient((prev) =>
                      prev ? { ...prev, fat: parseFloat(text) || 0 } : null
                    )
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.icon}
                />
              </View>
            </View>
          </ScrollView>

          <View
            style={[styles.modalActions, { borderTopColor: colors.border }]}
          >
            <TouchableOpacity
              style={[
                styles.modalCancelButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={[styles.modalCancelText, { color: colors.icon }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                { backgroundColor: colors.emerald500 },
              ]}
              onPress={handleSaveIngredient}
            >
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

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

  // Start continuous rotation animation for loading states
  useEffect(() => {
    const startRotation = () => {
      Animated.loop(
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    };

    if (isAnalyzing || isPosting || isUpdating) {
      startRotation();
    }
  }, [isAnalyzing, isPosting, isUpdating, scaleAnim]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      {!selectedMealType ? (
        <View style={styles.mealTypeSelectionScreen}>
          <MealTypeSelector onSelect={setSelectedMealType} />
        </View>
      ) : !selectedImage ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          alwaysBounceVertical={true}
        >
          <View style={styles.imageSelectionContainer}>
            <View style={styles.selectedMealTypeBanner}>
              <Text
                style={[
                  styles.selectedMealTypeBannerText,
                  { color: colors.text },
                ]}
              >
                📸 Ready to capture your {selectedMealType.label.toLowerCase()}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedMealType(null);
                }}
                style={styles.changeMealTypeButton}
              >
                <Text style={styles.changeMealTypeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
            <ImageSelector
              onTakePhoto={handleTakePhoto}
              onSelectFromGallery={handleSelectFromGallery}
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          alwaysBounceVertical={true}
        >
          <SelectedImage
            imageUri={selectedImage}
            userComment={userComment}
            isAnalyzing={isAnalyzing}
            hasBeenAnalyzed={hasBeenAnalyzed}
            onRemoveImage={() => {
              resetAnalysisState();
              setSelectedImage(null);
              setShowResults(false);
              setSelectedMealType(null);
              setShowMealTypeSelector(true);
            }}
            onRetakePhoto={handleTakePhoto}
            onAnalyze={handleAnalyzeImage}
            onCommentChange={setUserComment}
          />
          {showResults && analysisData && renderAnalysisResults()}
        </ScrollView>
      )}

      {renderEditModal()}
      {renderDeleteConfirmModal()}

      <ScanningAnimation
        visible={showScanAnimation}
        onComplete={() => setShowScanAnimation(false)}
        progress={analysisProgress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mealTypeSelectionScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  imageSelectionContainer: {
    flex: 1,
  },
  selectedMealTypeBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E6FFFA",
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#14B8A6",
  },
  selectedMealTypeBannerText: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  changeMealTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#14B8A6",
    borderRadius: 8,
  },
  changeMealTypeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Enhanced Image Selector Styles
  imageSelectorContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  imageSelectorGradient: {
    flex: 1,
    padding: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  imageSelectorContent: {
    alignItems: "center",
    width: "100%",
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectorTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  selectorSubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  selectorButtons: {
    width: "100%",
    gap: 16,
  },
  primarySelectorButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondarySelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  // Enhanced Selected Image Styles
  selectedImageContainer: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  imageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 12,
  },
  imageHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    position: "relative",
  },
  imageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    aspectRatio: 4 / 3,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  analysisOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  analysisIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  analysisText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  successIndicator: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  successText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  imageActions: {
    position: "absolute",
    bottom: 16,
    left: 16,
  },
  imageActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  imageActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  commentSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 80,
  },
  analyzeButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  analyzeButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Enhanced Results Styles
  resultsContainer: {
    paddingHorizontal: 24,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Enhanced Nutrition Card Styles
  nutritionCard: {
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  nutritionHeader: {
    padding: 24,
    paddingBottom: 20,
  },
  nutritionHeaderContent: {
    marginBottom: 16,
  },
  nutritionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  nutritionDate: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
  },
  caloriesBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignSelf: "center",
  },
  caloriesValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 36,
  },
  caloriesLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
    marginTop: -2,
  },
  macroGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  macroItem: {
    alignItems: "center",
    gap: 8,
  },
  macroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  macroEmoji: {
    fontSize: 20,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  // Enhanced Action Buttons Styles
  actionButtonsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  saveButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Enhanced Ingredients Styles
  ingredientsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  ingredientsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  ingredientNutrition: {
    fontSize: 14,
    marginBottom: 2,
  },
  ingredientActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },

  // Enhanced Health Insights Styles
  healthInsights: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: 20,
    width: screenWidth - 48,
    maxHeight: "80%",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: "row",
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  confirmModalContent: {
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginHorizontal: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Enhanced Scanning Animation Styles
  scanningOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanningContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  scanningArea: {
    alignItems: "center",
    gap: 24,
  },
  scanningIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  scanningTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  scanningSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  progressContainer: {
    width: screenWidth - 80,
    alignItems: "center",
    gap: 12,
  },
  progressTrack: {
    height: 6,
    width: "100%",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
  },
});