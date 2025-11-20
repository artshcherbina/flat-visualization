import { GoogleGenAI, Type, Modality } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface PromptPlan {
  label: string;
  prompt: string;
}

/**
 * Generates 5 distinct image prompts based on a user description.
 * It translates the request to English optimized for Imagen.
 */
export const generateImagePrompts = async (userDescription: string): Promise<PromptPlan[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following real estate description in Russian: "${userDescription}". 

      Step 1: Determine the implied "Class" of the property (Economy, Standard, or Luxury) based on keywords and context.
      - If Economy/Standard: The prompts must result in REALISTIC, authentic images. Avoid "luxury", "cinematic", or "opulent" styles. Use keywords like "soft natural light", "clean", "cozy", "realistic interior", "daylight", "standard materials". The goal is to make it look like a high-quality but honest real estate photo.
      - If Luxury/Premium: Use "architectural photography", "dramatic lighting", "expensive materials", "magazine cover style", "interior design masterpiece".

      Step 2: Create a plan for 5 distinct images. 
      Vary the lighting conditions (e.g., "soft morning light", "bright noon", "warm indoor lighting") to create visual variety across the set.

      The 5 shots must include:
      1. Exterior (Facade must match the building type/class inferred from description)
      2. Living Room (Interior)
      3. Kitchen/Dining (Interior)
      4. Bedroom (Interior)
      5. Bathroom or Balcony/View (Interior/Exterior)

      For each shot, provide a 'label' (in Russian) and a detailed 'prompt' (in English) optimized for a photorealistic image generator.
      
      Return the response as a JSON array of objects.`,
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
    // Ensure we have exactly 5, or slice if more
    return plans.slice(0, 5);
  } catch (error) {
    console.error("Error generating prompts:", error);
    throw new Error("Не удалось создать план визуализации. Попробуйте изменить описание.");
  }
};

/**
 * Generates a single image using the gemini-2.5-flash-image (Nano Banana) model.
 */
export const generateRealEstateImage = async (prompt: string): Promise<string> => {
  try {
    const finalPrompt = prompt + ", photorealistic, 8k, highly detailed";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: finalPrompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    
    if (part && part.inlineData && part.inlineData.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
};