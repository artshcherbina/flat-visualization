import { GoogleGenAI, Type } from "@google/genai";
import { generateImageWithNanoBanana } from "./nanoBananaService";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface PromptPlan {
  label: string;
  prompt: string;
}

/**
 * Generates distinct image prompts based on a user description.
 * @param userDescription - The real estate description in Russian
 * @param count - Number of images to generate (1-5, default 5)
 */
export const generateImagePrompts = async (userDescription: string, count: number = 5): Promise<PromptPlan[]> => {
  try {
    // Clamp count between 1 and 5
    const imageCount = Math.max(1, Math.min(5, count));

    const shotTypes = [
      "Exterior (Facade must match the building type/class inferred from description)",
      "Living Room (Interior)",
      "Kitchen/Dining (Interior)",
      "Bedroom (Interior)",
      "Bathroom or Balcony/View (Interior/Exterior)"
    ];

    const selectedShots = shotTypes.slice(0, imageCount);
    const shotsList = selectedShots.map((shot, idx) => `${idx + 1}. ${shot}`).join('\n      ');

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following real estate description in Russian: "${userDescription}".

      Step 1: Determine the implied "Class" of the property (Economy, Standard, or Luxury) based on keywords and context.
      - If Economy/Standard: The prompts must result in REALISTIC, authentic images. Avoid "luxury", "cinematic", or "opulent" styles. Use keywords like "soft natural light", "clean", "cozy", "realistic interior", "daylight", "standard materials". The goal is to make it look like a high-quality but honest real estate photo.
      - If Luxury/Premium: Use "architectural photography", "dramatic lighting", "expensive materials", "magazine cover style", "interior design masterpiece".

      Step 2: Create a plan for ${imageCount} distinct image${imageCount > 1 ? 's' : ''}.
      Vary the lighting conditions (e.g., "soft morning light", "bright noon", "warm indoor lighting") to create visual variety across the set.

      The ${imageCount} shot${imageCount > 1 ? 's' : ''} must include:
      ${shotsList}

      For each shot, provide a 'label' (in Russian) and a detailed 'prompt' (in English) optimized for a photorealistic image generator.

      Return the response as a JSON array of exactly ${imageCount} object${imageCount > 1 ? 's' : ''}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, description: "Short label in Russian" },
              prompt: { type: Type.STRING, description: "Detailed image generation prompt in English, styled according to property class" }
            },
            required: ["label", "prompt"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No text returned from prompt generation");

    const plans = JSON.parse(jsonText) as PromptPlan[];
    // Ensure we have exactly the requested count
    return plans.slice(0, imageCount);
  } catch (error) {
    console.error("Error generating prompts:", error);
    throw new Error("Не удалось создать план визуализации. Попробуйте изменить описание.");
  }
};

/**
 * Generates a single image using Nano Banana API (kie.ai).
 * This replaces the previous Gemini image generation with the more reliable Nano Banana service.
 */
export const generateRealEstateImage = async (prompt: string): Promise<string> => {
  try {
    // Use Nano Banana API for image generation
    const base64Image = await generateImageWithNanoBanana(prompt, "16:9");
    return base64Image;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};