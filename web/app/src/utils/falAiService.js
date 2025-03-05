// Utility for generating images using fal.ai
import { fal } from "@fal-ai/client";

const FAL_AI_API_KEY = import.meta.env.VITE_FAL_AI_API_KEY;

// Configure fal client with API key
fal.config({
  credentials: FAL_AI_API_KEY
});

/**
 * Generate an image using fal.ai's Ideogram model
 * @param {string} prompt - The description of the image to generate
 * @param {string} aspectRatio - The aspect ratio of the image (default: "1:1")
 * @param {string} style - The style of the image (default: "auto")
 * @returns {Promise<string>} - URL of the generated image
 */
export async function generateImage(prompt, aspectRatio = "1:1", style = "auto") {
  console.log(`🔄 Generating image with prompt: "${prompt}"`);
  console.log(`📐 Using aspect ratio: ${aspectRatio}, style: ${style}`);
  
  try {
    const startTime = Date.now();
    
    const result = await fal.subscribe("fal-ai/ideogram/v2", {
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        expand_prompt: true,
        style
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`🔄 Generation in progress: ${update.status}`);
          update.logs.map((log) => log.message).forEach(msg => console.log(`📋 ${msg}`));
        }
      },
    });
    
    const requestTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Image generation completed in ${requestTime}s`);

    if (result.data && result.data.images && result.data.images.length > 0) {
      console.log(`🖼️ Generated image URL: ${result.data.images[0].url}`);
      return result.data.images[0].url;
    } else {
      console.error('❌ No image was generated in the response:', result);
      throw new Error('No image was generated');
    }
  } catch (error) {
    console.error('❌ Error generating image:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}