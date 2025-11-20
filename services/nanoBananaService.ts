/**
 * Nano Banana API Service
 * Image generation using kie.ai's Nano Banana API (Gemini 2.5 Flash Image Preview)
 */

const API_KEY = "26dba80bd44fbc185858efd0354a5287";
const BASE_URL = "https://api.kie.ai/api/v1/jobs";
const CREATE_TASK_ENDPOINT = `${BASE_URL}/createTask`;
const QUERY_TASK_ENDPOINT = `${BASE_URL}/recordInfo`;

export interface NanoBananaTaskResponse {
    code: number;
    msg: string;
    data: {
        taskId: string;
        recordId: string;
    };
}

export interface NanoBananaStatusResponse {
    code: number;
    msg: string;
    data: {
        taskId: string;
        model: string;
        state: "waiting" | "generating" | "success" | "SUCCESS" | "failed" | "FAILED" | "error" | "ERROR";
        resultJson: string;
        failCode: string | null;
        failMsg: string | null;
        costTime: number | null;
        completeTime: number | null;
        createTime: number;
    };
}

export interface ImageGenerationOptions {
    prompt: string;
    output_format?: "png" | "jpeg";
    image_size?: "1:1" | "9:16" | "16:9" | "3:4" | "4:3" | "3:2" | "2:3" | "5:4" | "4:5" | "21:9" | "auto";
}

/**
 * Create an image generation task
 */
async function createImageTask(options: ImageGenerationOptions): Promise<string> {
    const response = await fetch(CREATE_TASK_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
            model: "google/nano-banana",
            callBackUrl: null,
            input: {
                prompt: options.prompt,
                output_format: options.output_format || "png",
                image_size: options.image_size || "16:9",
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create task: ${response.status} ${errorText}`);
    }

    const result: NanoBananaTaskResponse = await response.json();

    if (result.code !== 200) {
        throw new Error(`API error: ${result.msg}`);
    }

    return result.data.taskId;
}

/**
 * Query task status
 */
async function queryTaskStatus(taskId: string): Promise<NanoBananaStatusResponse> {
    const url = `${QUERY_TASK_ENDPOINT}?taskId=${taskId}`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to query task: ${response.status} ${errorText}`);
    }

    const result: NanoBananaStatusResponse = await response.json();

    if (result.code !== 200) {
        throw new Error(`API error: ${result.msg}`);
    }

    return result;
}

/**
 * Poll task until completion
 */
async function pollTaskCompletion(
    taskId: string,
    maxAttempts: number = 60,
    interval: number = 2000
): Promise<NanoBananaStatusResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const result = await queryTaskStatus(taskId);
        const state = result.data.state;

        if (state === "success" || state === "SUCCESS") {
            return result;
        } else if (state === "failed" || state === "FAILED" || state === "error" || state === "ERROR") {
            throw new Error(`Task failed: ${result.data.failMsg || "Unknown error"}`);
        }

        // Task still processing (waiting or generating)
        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Task timeout: did not complete within ${(maxAttempts * interval) / 1000} seconds`);
}

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new Error("Failed to convert image to base64"));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read image blob"));
        reader.readAsDataURL(blob);
    });
}

/**
 * Generate image using Nano Banana API
 * Returns base64 encoded image data URL
 */
export async function generateImageWithNanoBanana(
    prompt: string,
    imageSize: ImageGenerationOptions["image_size"] = "16:9"
): Promise<string> {
    try {
        // Enhance the prompt for photorealistic results
        const enhancedPrompt = `${prompt}, photorealistic, 8k, highly detailed`;

        // Step 1: Create task
        const taskId = await createImageTask({
            prompt: enhancedPrompt,
            output_format: "png",
            image_size: imageSize,
        });

        // Step 2: Poll for completion
        const result = await pollTaskCompletion(taskId);

        // Step 3: Extract image URL from resultJson
        const resultData = JSON.parse(result.data.resultJson);
        const imageUrls = resultData.resultUrls as string[];

        if (!imageUrls || imageUrls.length === 0) {
            throw new Error("No image URLs in result");
        }

        const imageUrl = imageUrls[0];

        // Step 4: Download and convert to base64
        const base64Image = await downloadImageAsBase64(imageUrl);

        return base64Image;
    } catch (error) {
        console.error("Nano Banana API error:", error);
        throw error;
    }
}
