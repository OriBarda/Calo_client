import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface StorageInfo {
  totalSize: number;
  usedSize: number;
  availableSize: number;
  largeItems: Array<{
    key: string;
    size: number;
  }>;
}

export class StorageCleanupService {
  private static readonly STORAGE_WARNING_THRESHOLD = 0.7; // 70%
  private static readonly STORAGE_CRITICAL_THRESHOLD = 0.85; // 85%
  private static readonly LARGE_ITEM_THRESHOLD = 512; // 512 bytes
  private static readonly MAX_STORAGE_SIZE = 6 * 1024 * 1024; // 6MB to be safer
  private static readonly SECURE_STORE_SIZE_LIMIT = 2048; // SecureStore limit

  static async checkAndCleanupIfNeeded(): Promise<boolean> {
    try {
      // Check available storage first
      const hasSpace = await this.checkAvailableStorage();
      if (!hasSpace) {
        console.log("🚨 No available storage, running emergency cleanup");
        return await this.emergencyCleanup();
      }

      // First, handle SQLITE_FULL emergency
      if (await this.isDatabaseFull()) {
        console.log("🚨 Database full detected, running emergency cleanup");
        return await this.emergencyCleanup();
      }

      const storageInfo = await this.getStorageInfo();
      const usageRatio = storageInfo.usedSize / storageInfo.totalSize;

      console.log(
        `📊 Storage usage: ${Math.round(usageRatio * 100)}% (${
          storageInfo.usedSize
        }/${storageInfo.totalSize} bytes)`
      );

      if (usageRatio > this.STORAGE_CRITICAL_THRESHOLD) {
        console.log(
          "🚨 Critical storage usage detected, running emergency cleanup"
        );
        return await this.emergencyCleanup();
      } else if (usageRatio > this.STORAGE_WARNING_THRESHOLD) {
        console.log("⚠️ High storage usage detected, running routine cleanup");
        return await this.routineCleanup();
      }

      // Check for oversized SecureStore items
      await this.handleOversizedSecureStoreItems();

      return true;
    } catch (error) {
      console.error("❌ Storage check failed:", error);
      // If storage check fails, try emergency cleanup
      return await this.emergencyCleanup();
    }
  }

  static async checkAvailableStorage(): Promise<boolean> {
    try {
      // Try to write a small test item
      const testKey = `storage_test_${Date.now()}`;
      const testData = "test_data_for_storage_check";

      await AsyncStorage.setItem(testKey, testData);
      await AsyncStorage.removeItem(testKey);

      return true;
    } catch (error: any) {
      console.error("🚨 Storage availability check failed:", error);

      // Check for specific storage full errors
      const isStorageFull =
        error?.message?.includes("database or disk is full") ||
        error?.message?.includes("SQLITE_FULL") ||
        error?.code === 13 ||
        error?.message?.includes("No space left") ||
        error?.message?.includes("disk full");

      return !isStorageFull;
    }
  }

  static async isDatabaseFull(): Promise<boolean> {
    try {
      // Try a simple storage operation
      const testKey = "storage_test_" + Date.now();
      await AsyncStorage.setItem(testKey, "test");
      await AsyncStorage.removeItem(testKey);
      return false;
    } catch (error: any) {
      console.error("🚨 Database storage test failed:", error);
      return (
        error?.message?.includes("database or disk is full") ||
        error?.code === 13 ||
        error?.message?.includes("SQLITE_FULL") ||
        error?.message?.includes("disk full") ||
        error?.message?.includes("No space left")
      );
    }
  }

  static async emergencyCleanup(): Promise<boolean> {
    try {
      console.log("🆘 Starting emergency storage cleanup...");

      // 0. Clear all TanStack Query cache first
      try {
        const { queryClient } = await import("../services/queryClient");
        queryClient.clear();
        console.log("✅ Cleared TanStack Query cache");
      } catch (error) {
        console.warn("⚠️ Failed to clear query cache:", error);
      }

      // 1. Clear all cached images and temporary data immediately
      await this.clearCachedImages();

      // 2. Clear old meal data (keep only last 3 days in emergency)
      await this.clearOldMealData(3);

      // 3. Clear Redux persist data except auth
      await this.clearNonCriticalReduxData();

      // 4. Clear large SecureStore items
      await this.clearLargeSecureStoreItems();

      // 5. Clear analytics and debug data
      await this.clearAnalyticsData();

      // 6. Clear all non-essential AsyncStorage keys
      await this.clearNonEssentialData();

      // 7. Compact remaining data
      await this.compactStorageData();

      // 8. Force garbage collection
      if (global.gc) {
        global.gc();
      }

      console.log("✅ Emergency cleanup completed");
      return true;
    } catch (error) {
      console.error("❌ Emergency cleanup failed:", error);
      return false;
    }
  }

  private static async clearNonEssentialData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const nonEssentialKeys = keys.filter(
        (key) =>
          key.includes("cache_") ||
          key.includes("temp_") ||
          key.includes("debug_") ||
          key.includes("log_") ||
          key.includes("analytics_") ||
          key.includes("performance_") ||
          key.includes("crash_") ||
          key.includes("query_") ||
          key.includes("image_") ||
          key.includes("photo_") ||
          key.includes("base64_") ||
          key.startsWith("rn:") ||
          key.startsWith("__") ||
          key.includes("react-query") ||
          key.includes("@react-navigation") ||
          key.includes("expo-") ||
          key.includes("flipper")
      );

      if (nonEssentialKeys.length > 0) {
        await AsyncStorage.multiRemove(nonEssentialKeys);
        console.log(
          `🗑️ Cleared ${nonEssentialKeys.length} non-essential items`
        );
      }
    } catch (error) {
      console.error("Failed to clear non-essential data:", error);
    }
  }

  private static async compactStorageData(): Promise<void> {
    try {
      // Get all remaining keys and their data
      const keys = await AsyncStorage.getAllKeys();
      const essentialKeys = keys.filter(
        (key) =>
          key.includes("persist:auth") ||
          key.includes("auth_token") ||
          key.includes("user_") ||
          key.includes("language") ||
          key.includes("theme") ||
          key.includes("notification")
      );

      // Compact each essential item
      for (const key of essentialKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value && value.length > 1000) {
            const compressed = this.compressString(value);
            if (compressed.length < value.length * 0.8) {
              await AsyncStorage.setItem(key, compressed);
              console.log(
                `🗜️ Compacted ${key}: ${value.length} -> ${compressed.length} bytes`
              );
            }
          }
        } catch (error) {
          console.warn(`Failed to compact ${key}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to compact storage data:", error);
    }
  }

  static async routineCleanup(): Promise<boolean> {
    try {
      console.log("🧹 Starting routine storage cleanup...");

      // 1. Clear old meal data (30 days)
      await this.clearOldMealData(30);

      // 2. Compress large items
      await this.compressLargeItems();

      // 3. Handle oversized SecureStore items
      await this.handleOversizedSecureStoreItems();

      // 4. Clear temporary files
      await this.clearTemporaryData();

      console.log("✅ Routine cleanup completed");
      return true;
    } catch (error) {
      console.error("❌ Routine cleanup failed:", error);
      return false;
    }
  }

  private static async getStorageInfo(): Promise<StorageInfo> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalUsedSize = 0;
      const largeItems: Array<{ key: string; size: number }> = [];

      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          const itemSize = value ? new Blob([value]).size : 0;
          totalUsedSize += itemSize;

          if (itemSize > this.LARGE_ITEM_THRESHOLD) {
            largeItems.push({ key, size: itemSize });
          }
        } catch (error) {
          console.warn(`Failed to get size for key ${key}:`, error);
          // If we can't read it, it's probably corrupted - remove it
          try {
            await AsyncStorage.removeItem(key);
          } catch (e) {
            // Ignore removal errors
          }
        }
      }

      return {
        totalSize: this.MAX_STORAGE_SIZE,
        usedSize: totalUsedSize,
        availableSize: this.MAX_STORAGE_SIZE - totalUsedSize,
        largeItems: largeItems.sort((a, b) => b.size - a.size),
      };
    } catch (error) {
      console.error("Failed to get storage info:", error);
      return {
        totalSize: this.MAX_STORAGE_SIZE,
        usedSize: 0,
        availableSize: this.MAX_STORAGE_SIZE,
        largeItems: [],
      };
    }
  }

  private static async clearCachedImages(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const imageKeys = keys.filter(
        (key) =>
          key.includes("image_") ||
          key.includes("cached_") ||
          key.includes("photo_") ||
          key.includes("base64_") ||
          key.includes("pendingMeal") ||
          key.startsWith("rn:") ||
          key.includes("ImagePicker") ||
          key.includes("CameraRoll") ||
          key.includes("MediaLibrary") ||
          key.includes("FileSystem")
      );

      if (imageKeys.length > 0) {
        await AsyncStorage.multiRemove(imageKeys);
        console.log(`🖼️ Cleared ${imageKeys.length} cached images`);
      }
    } catch (error) {
      console.error("Failed to clear cached images:", error);
    }
  }

  private static async clearOldMealData(
    daysToKeep: number = 30
  ): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = [];

      for (const key of keys) {
        if (
          key.includes("meal_") ||
          key.includes("pendingMeal") ||
          key.includes("persist:meal")
        ) {
          try {
            const value = await AsyncStorage.getItem(key);
            if (value) {
              const data = JSON.parse(value);
              const timestamp =
                data.timestamp || data.created_at || data.upload_time;

              if (timestamp && new Date(timestamp) < cutoffDate) {
                keysToRemove.push(key);
              } else if (!timestamp) {
                // If no timestamp, it's probably old or corrupted
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // If we can't parse it, it's probably corrupted, remove it
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`🗑️ Cleared ${keysToRemove.length} old meal data items`);
      }
    } catch (error) {
      console.error("Failed to clear old meal data:", error);
    }
  }

  private static async clearNonCriticalReduxData(): Promise<void> {
    try {
      // Keep auth data, clear everything else
      const persistKeys = [
        "persist:meal",
        "persist:calendar",
        "persist:questionnaire",
        "persist:statistics",
      ];
      await AsyncStorage.multiRemove(persistKeys);
      console.log("🔄 Cleared non-critical Redux persist data");
    } catch (error) {
      console.error("Failed to clear Redux data:", error);
    }
  }

  private static async clearLargeSecureStoreItems(): Promise<void> {
    if (Platform.OS !== "web") {
      try {
        const potentialKeys = [
          "pendingMeal",
          "cachedUserData",
          "largeImageData",
          "auth_token_large",
          "meal_cache",
          "user_profile_cache",
        ];

        for (const key of potentialKeys) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch (error) {
            // Key might not exist, that's OK
          }
        }
        console.log("🔐 Cleared large SecureStore items");
      } catch (error) {
        console.warn("Failed to clear SecureStore items:", error);
      }
    }
  }

  private static async clearAnalyticsData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const analyticsKeys = keys.filter(
        (key) =>
          key.includes("analytics_") ||
          key.includes("debug_") ||
          key.includes("log_") ||
          key.includes("crash_") ||
          key.includes("performance_")
      );

      if (analyticsKeys.length > 0) {
        await AsyncStorage.multiRemove(analyticsKeys);
        console.log(`📊 Cleared ${analyticsKeys.length} analytics items`);
      }
    } catch (error) {
      console.error("Failed to clear analytics data:", error);
    }
  }

  private static async clearTemporaryData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const tempKeys = keys.filter(
        (key) =>
          key.includes("temp_") ||
          key.includes("tmp_") ||
          key.includes("cache_") ||
          key.startsWith("__") ||
          key.includes("query_cache")
      );

      if (tempKeys.length > 0) {
        await AsyncStorage.multiRemove(tempKeys);
        console.log(`🧹 Cleared ${tempKeys.length} temporary items`);
      }
    } catch (error) {
      console.error("Failed to clear temporary data:", error);
    }
  }

  private static async handleOversizedSecureStoreItems(): Promise<void> {
    if (Platform.OS === "web") return;

    try {
      // Check common keys that might be oversized
      const keysToCheck = ["persist:auth", "user_data", "meal_data"];

      for (const key of keysToCheck) {
        try {
          const value = await SecureStore.getItemAsync(key);
          if (value && value.length > this.SECURE_STORE_SIZE_LIMIT) {
            console.log(
              `⚠️ SecureStore item ${key} is oversized (${value.length} bytes), splitting...`
            );

            // Split large items into chunks
            await this.splitLargeSecureStoreItem(key, value);
          }
        } catch (error) {
          // Key might not exist or be corrupted
          try {
            await SecureStore.deleteItemAsync(key);
            console.log(`🗑️ Removed corrupted SecureStore item: ${key}`);
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (error) {
      console.error("Failed to handle oversized SecureStore items:", error);
    }
  }

  private static async splitLargeSecureStoreItem(
    key: string,
    value: string
  ): Promise<void> {
    try {
      const chunkSize = this.SECURE_STORE_SIZE_LIMIT - 100; // Leave some buffer
      const chunks = [];

      for (let i = 0; i < value.length; i += chunkSize) {
        chunks.push(value.substring(i, i + chunkSize));
      }

      // Store chunk count and chunks
      await SecureStore.setItemAsync(`${key}_chunks`, chunks.length.toString());

      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
      }

      // Remove original oversized item
      await SecureStore.deleteItemAsync(key);

      console.log(`✅ Split ${key} into ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Failed to split SecureStore item ${key}:`, error);
      // If splitting fails, just delete the item
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        // Ignore
      }
    }
  }

  private static async compressLargeItems(): Promise<void> {
    try {
      const storageInfo = await this.getStorageInfo();

      for (const item of storageInfo.largeItems.slice(0, 3)) {
        // Only compress top 3 largest
        try {
          const value = await AsyncStorage.getItem(item.key);
          if (value && item.size > 1024) {
            // Simple compression
            const compressed = this.compressString(value);
            if (compressed.length < value.length * 0.9) {
              // Only if 10% compression achieved
              await AsyncStorage.setItem(item.key, compressed);
              console.log(
                `🗜️ Compressed ${item.key}: ${item.size} -> ${compressed.length} bytes`
              );
            }
          }
        } catch (error) {
          console.warn(`Failed to compress ${item.key}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to compress large items:", error);
    }
  }

  private static compressString(str: string): string {
    try {
      // Simple compression: remove unnecessary whitespace and repeated patterns
      return str
        .replace(/\s+/g, " ")
        .replace(/\n\s*/g, "\n")
        .replace(/\r/g, "")
        .trim();
    } catch (error) {
      return str;
    }
  }

  static async getStorageReport(): Promise<StorageInfo> {
    return await this.getStorageInfo();
  }

  static async handleSecureStoreSizeWarning(
    key: string,
    value: string
  ): Promise<void> {
    if (Platform.OS === "web") return;

    if (value.length > this.SECURE_STORE_SIZE_LIMIT) {
      console.log(
        `⚠️ Attempting to store oversized value in SecureStore (${value.length} bytes)`
      );

      // Try to compress first
      const compressed = this.compressString(value);
      if (compressed.length <= this.SECURE_STORE_SIZE_LIMIT) {
        console.log(`✅ Compressed ${key} to fit SecureStore`);
        await SecureStore.setItemAsync(key, compressed);
      } else {
        // If still too large, split it
        await this.splitLargeSecureStoreItem(key, value);
      }
    }
  }

  // Add method to monitor storage usage
  static async monitorStorageUsage(): Promise<void> {
    try {
      const storageInfo = await this.getStorageInfo();
      const usageRatio = storageInfo.usedSize / storageInfo.totalSize;

      console.log(`📊 Storage Monitor: ${Math.round(usageRatio * 100)}% used`);

      if (usageRatio > 0.8) {
        console.warn("⚠️ Storage usage is high, consider cleanup");
      }

      // Log largest items for debugging
      if (storageInfo.largeItems.length > 0) {
        console.log("📦 Largest storage items:");
        storageInfo.largeItems.slice(0, 5).forEach((item) => {
          console.log(`  - ${item.key}: ${Math.round(item.size / 1024)}KB`);
        });
      }
    } catch (error) {
      console.error("Failed to monitor storage:", error);
    }
  }
}
