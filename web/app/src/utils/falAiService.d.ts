declare module './falAiService' {
  /**
   * Generate an image using fal.ai's Ideogram model
   * @param prompt - The description of the image to generate
   * @param aspectRatio - The aspect ratio of the image (default: "1:1")
   * @param style - The style of the image (default: "auto")
   * @returns URL of the generated image
   */
  export function generateImage(
    prompt: string, 
    aspectRatio?: string, 
    style?: string
  ): Promise<string>;
} 