import { prisma } from "../lib/database";
import { openai } from "./openai";
import axios from "axios";

interface ProductData {
  barcode?: string;
  name: string;
  brand?: string;
  category: string;
  nutrition_per_100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
  ingredients: string[];
  allergens: string[];
  labels: string[];
  health_score?: number;
  image_url?: string;
}

interface UserAnalysis {
  compatibility_score: number;
  daily_contribution: {
    calories_percent: number;
    protein_percent: number;
    carbs_percent: number;
    fat_percent: number;
  };
  alerts: string[];
  recommendations: string[];
  health_assessment: string;
}

export class FoodScannerService {
  static async scanBarcode(
    barcode: string,
    userId: string
  ): Promise<{
    product: ProductData;
    user_analysis: UserAnalysis;
  }> {
    try {
      console.log("🔍 Scanning barcode:", barcode);

      // Try to get product from our database first
      let productData = await this.getProductFromDatabase(barcode);

      if (!productData) {
        // Try external food database APIs
        productData = await this.getProductFromExternalAPI(barcode);

        if (!productData) {
          throw new Error("Product not found in any database");
        }

        // Save to our database for future use
        await this.saveProductToDatabase(productData, barcode, userId);
      }

      // Get user-specific analysis
      const userAnalysis = await this.analyzeProductForUser(
        productData,
        userId
      );

      return {
        product: productData,
        user_analysis: userAnalysis,
      };
    } catch (error) {
      console.error("💥 Barcode scan error:", error);
      throw error;
    }
  }

  static async scanProductImage(
    imageBase64: string,
    userId: string
  ): Promise<{
    product: ProductData;
    user_analysis: UserAnalysis;
  }> {
    try {
      console.log("📷 Scanning product image with AI...");

      if (!openai || !process.env.OPENAI_API_KEY) {
        throw new Error("AI image scanning not available - no API key");
      }

      const systemPrompt = `You are a nutrition label scanner. Analyze the food product image and extract nutritional information.

Return JSON with this exact structure:
{
  "name": "Product name",
  "brand": "Brand name if visible",
  "category": "Food category (dairy, snacks, grains, etc.)",
  "nutrition_per_100g": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "fiber": number,
    "sugar": number,
    "sodium": number
  },
  "ingredients": ["ingredient1", "ingredient2"],
  "allergens": ["allergen1", "allergen2"],
  "labels": ["kosher", "vegan", "gluten-free"],
  "health_score": number (0-100),
  "barcode": "if visible"
}

If you cannot read the label clearly, estimate based on visible information and note uncertainty.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this food product label and extract nutritional information.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const productData = JSON.parse(content) as ProductData;

      // Save to database if barcode was detected
      if (productData.barcode) {
        await this.saveProductToDatabase(
          productData,
          productData.barcode,
          userId
        );
      }

      // Get user-specific analysis
      const userAnalysis = await this.analyzeProductForUser(
        productData,
        userId
      );

      return {
        product: productData,
        user_analysis: userAnalysis,
      };
    } catch (error) {
      console.error("💥 Image scan error:", error);
      throw error;
    }
  }

  static async addProductToMealLog(
    userId: string,
    productData: ProductData,
    quantity: number,
    mealTiming: string = "SNACK"
  ): Promise<any> {
    try {
      console.log("📝 Adding product to meal log...");

      // Calculate nutrition for the specified quantity
      const nutritionPer100g = productData.nutrition_per_100g;
      const multiplier = quantity / 100;

      const mealData = {
        meal_name: `${productData.name} (${quantity}g)`,
        calories: Math.round(nutritionPer100g.calories * multiplier),
        protein_g: Math.round(nutritionPer100g.protein * multiplier),
        carbs_g: Math.round(nutritionPer100g.carbs * multiplier),
        fats_g: Math.round(nutritionPer100g.fat * multiplier),
        fiber_g: nutritionPer100g.fiber
          ? Math.round(nutritionPer100g.fiber * multiplier)
          : null,
        sugar_g: nutritionPer100g.sugar
          ? Math.round(nutritionPer100g.sugar * multiplier)
          : null,
        sodium_mg: nutritionPer100g.sodium
          ? Math.round(nutritionPer100g.sodium * multiplier)
          : null,
        serving_size_g: quantity,
        food_category: productData.category,
        ingredients: JSON.stringify(productData.ingredients),
        additives_json: {
          allergens: productData.allergens,
          labels: productData.labels,
        },
        image_url: "", // Add the required image_url field
        health_score: productData.health_score || 50,
      };

      const meal = await prisma.meal.create({
        data: {
          user_id: userId,
          analysis_status: "COMPLETED",
          ...mealData,
          upload_time: new Date(),
          created_at: new Date(),
        },
      });

      // Award achievement for first scan
      await this.checkAndAwardAchievements(userId);

      return meal;
    } catch (error) {
      console.error("💥 Add to meal log error:", error);
      throw error;
    }
  }

  static async getScanHistory(userId: string): Promise<any[]> {
    try {
      const products = await prisma.foodProduct.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 50,
      });

      return products;
    } catch (error) {
      console.error("Error getting scan history:", error);
      return [];
    }
  }

  private static async getProductFromDatabase(
    barcode: string
  ): Promise<ProductData | null> {
    try {
      const product = await prisma.foodProduct.findUnique({
        where: { barcode },
      });

      if (!product) return null;

      return {
        barcode: product.barcode,
        name: product.product_name,
        brand: product.brand || undefined,
        category: product.category,
        nutrition_per_100g: product.nutrition_per_100g as any,
        ingredients: product.ingredients as string[],
        allergens: product.allergens as string[],
        labels: product.labels as string[],
        health_score: product.health_score || undefined,
        image_url: product.image_url || undefined,
      };
    } catch (error) {
      console.error("Error getting product from database:", error);
      return null;
    }
  }

  private static async getProductFromExternalAPI(
    barcode: string
  ): Promise<ProductData | null> {
    try {
      // Try OpenFoodFacts
      const response = await axios.get(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        { timeout: 5000 }
      );

      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        const nutriments = product.nutriments || {};

        return {
          barcode,
          name: product.product_name || "Unknown Product",
          brand: product.brands || undefined,
          category: product.categories?.split(",")[0] || "Unknown",
          nutrition_per_100g: {
            calories: nutriments.energy_kcal_100g || 0,
            protein: nutriments.proteins_100g || 0,
            carbs: nutriments.carbohydrates_100g || 0,
            fat: nutriments.fat_100g || 0,
            fiber: nutriments.fiber_100g || undefined,
            sugar: nutriments.sugars_100g || undefined,
            sodium: nutriments.sodium_100g
              ? nutriments.sodium_100g * 1000
              : undefined,
          },
          ingredients:
            product.ingredients_text_en
              ?.split(",")
              .map((i: string) => i.trim()) || [],
          allergens:
            product.allergens_tags?.map((a: string) => a.replace("en:", "")) ||
            [],
          labels:
            product.labels_tags?.map((l: string) => l.replace("en:", "")) || [],
          health_score: product.nutriscore_score || undefined,
          image_url: product.image_url || undefined,
        };
      }

      return null;
    } catch (error: any) {
      console.warn("❌ OpenFoodFacts failed:", error.message || error);
      return null;
    }
  }

  private static async saveProductToDatabase(
    productData: ProductData,
    barcode: string,
    user_id: string
  ): Promise<void> {
    try {
      await prisma.foodProduct.upsert({
        where: { barcode },
        update: {
          product_name: productData.name,
          brand: productData.brand,
          category: productData.category,
          nutrition_per_100g: productData.nutrition_per_100g,
          ingredients: productData.ingredients,
          allergens: productData.allergens,
          labels: productData.labels,
          health_score: productData.health_score,
          image_url: productData.image_url,
          updated_at: new Date(),
        },
        create: {
          barcode,
          product_name: productData.name,
          brand: productData.brand,
          category: productData.category,
          nutrition_per_100g: productData.nutrition_per_100g,
          ingredients: productData.ingredients,
          allergens: productData.allergens,
          labels: productData.labels,
          health_score: productData.health_score,
          image_url: productData.image_url,
          user_id,
          created_at: new Date(),
        },
      });
    } catch (error) {
      console.error("Error saving product to database:", error);
    }
  }

  private static async analyzeProductForUser(
    productData: ProductData,
    userId: string
  ): Promise<UserAnalysis> {
    try {
      // Get user's nutrition goals and preferences
      const [nutritionPlan, questionnaire] = await Promise.all([
        prisma.nutritionPlan.findFirst({ where: { user_id: userId } }),
        prisma.userQuestionnaire.findFirst({ where: { user_id: userId } }),
      ]);

      const analysis: UserAnalysis = {
        compatibility_score: 70,
        daily_contribution: {
          calories_percent: 0,
          protein_percent: 0,
          carbs_percent: 0,
          fat_percent: 0,
        },
        alerts: [],
        recommendations: [],
        health_assessment: "מוצר נייטרלי מבחינה תזונתית",
      };

      // Calculate daily contribution percentages
      if (nutritionPlan) {
        const nutrition = productData.nutrition_per_100g;
        analysis.daily_contribution = {
          calories_percent: nutritionPlan.goal_calories
            ? (nutrition.calories / nutritionPlan.goal_calories) * 100
            : 0,
          protein_percent: nutritionPlan.goal_protein_g
            ? (nutrition.protein / nutritionPlan.goal_protein_g) * 100
            : 0,
          carbs_percent: nutritionPlan.goal_carbs_g
            ? (nutrition.carbs / nutritionPlan.goal_carbs_g) * 100
            : 0,
          fat_percent: nutritionPlan.goal_fats_g
            ? (nutrition.fat / nutritionPlan.goal_fats_g) * 100
            : 0,
        };
      }

      // Check for dietary restrictions
      if (questionnaire) {
        const userAllergies =
          (questionnaire.allergies as string[] | null | undefined) || [];
        const productAllergens = productData.allergens || [];
        const allergenMatches = userAllergies.filter((allergy: string) =>
          productAllergens.some((allergen) =>
            allergen.toLowerCase().includes(allergy.toLowerCase())
          )
        );

        if (allergenMatches.length > 0) {
          analysis.alerts.push(
            `⚠️ אלרגן: המוצר מכיל ${allergenMatches.join(", ")}`
          );
          analysis.compatibility_score -= 30;
        }

        // Check dietary style compatibility
        const dietaryStyle = questionnaire.dietary_style?.toLowerCase();
        const productLabels = productData.labels.map((l) => l.toLowerCase());

        if (dietaryStyle === "vegan" && !productLabels.includes("vegan")) {
          analysis.alerts.push("🌱 המוצר אינו מתאים לתזונה טבגנית");
          analysis.compatibility_score -= 20;
        }

        if (dietaryStyle === "vegetarian" && productLabels.includes("meat")) {
          analysis.alerts.push("🥬 המוצר מכיל בשר ואינו מתאים לצמחונים");
          analysis.compatibility_score -= 20;
        }

        if (questionnaire.kosher && !productLabels.includes("kosher")) {
          analysis.alerts.push("✡️ המוצר אינו כשר");
          analysis.compatibility_score -= 15;
        }
      }

      // Health assessment based on nutrition
      const nutrition = productData.nutrition_per_100g;

      if (nutrition.sugar && nutrition.sugar > 15) {
        analysis.alerts.push("🍯 מוצר עתיר סוכר");
        analysis.compatibility_score -= 10;
      }

      if (nutrition.sodium && nutrition.sodium > 500) {
        analysis.alerts.push("🧂 מוצר עתיר נתרן");
        analysis.compatibility_score -= 10;
      }

      if (nutrition.protein > 10) {
        analysis.recommendations.push(
          "💪 מוצר עשיר בחלבון - מצוין למטרות בניית שריר"
        );
        analysis.compatibility_score += 10;
      }

      if (nutrition.fiber && nutrition.fiber > 5) {
        analysis.recommendations.push(
          "🌾 מוצר עשיר בסיבים תזונתיים - תורם לבריאות המעיים"
        );
        analysis.compatibility_score += 5;
      }

      // Generate health assessment
      if (analysis.compatibility_score >= 80) {
        analysis.health_assessment = "מוצר מתאים מאוד למטרות התזונתיות שלך! ✅";
      } else if (analysis.compatibility_score >= 60) {
        analysis.health_assessment = "מוצר בסדר עם כמה הסתייגויות קלות 🟡";
      } else if (analysis.compatibility_score >= 40) {
        analysis.health_assessment =
          "מוצר עם מספר בעיות תזונתיות - צריכה מוגבלת 🟠";
      } else {
        analysis.health_assessment = "מוצר לא מומלץ למטרות התזונתיות שלך ❌";
      }

      return analysis;
    } catch (error) {
      console.error("Error analyzing product for user:", error);
      return {
        compatibility_score: 50,
        daily_contribution: {
          calories_percent: 0,
          protein_percent: 0,
          carbs_percent: 0,
          fat_percent: 0,
        },
        alerts: [],
        recommendations: [],
        health_assessment: "לא הצלחנו לנתח את המוצר",
      };
    }
  }

  private static async checkAndAwardAchievements(
    userId: string
  ): Promise<void> {
    try {
      // Check for first scan achievement
      const scanCount = await prisma.meal.count({
        where: { user_id: userId },
      });

      if (scanCount === 1) {
        // This is the first scan, award achievement
        await prisma.userAchievement.upsert({
          where: {
            user_id_achievement_id: {
              user_id: userId,
              achievement_id: "first_scan",
            },
          },
          update: {
            progress: 1,
            unlocked: true,
            unlocked_date: new Date(),
          },
          create: {
            user_id: userId,
            achievement_id: "first_scan",
            progress: 1,
            unlocked: true,
            unlocked_date: new Date(),
          },
        });

        // Award XP
        await prisma.user.update({
          where: { user_id: userId },
          data: {
            current_xp: { increment: 50 },
            total_points: { increment: 50 },
          },
        });
      }
    } catch (error) {
      console.error("Error checking achievements:", error);
    }
  }
}
