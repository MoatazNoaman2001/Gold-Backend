import dotenv from 'dotenv';
dotenv.config();
import OpenAI from 'openai';
class AIProductDescriptionService {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }
  async generateDescription(productData) {
    try {
      const prompt = this.createPrompt(productData);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional product description writer for e-commerce. Create compelling, SEO-friendly descriptions that highlight key features and benefits. Keep descriptions concise but informative and simple words if title arabic give me arabic description, typically 25-50 words."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating description:', error);
      throw new Error('Failed to generate product description');
    }
  }

  /**
   * Create prompt for AI based on product data
   */
  createPrompt(productData) {
    let prompt = `Write a professional, SEO-friendly product description for a jewelry item with the following details:\n\n`;
    if (productData.title) {
      prompt += `Product Name: ${productData.title}\n`;
    }
    if (productData.category) {
      prompt += `Category: ${productData.category}\n`;
    }
    if (productData.brand) {
      prompt += `Brand: ${productData.brand}\n`;
    }
    if (productData.karat) {
      prompt += `Karat: ${productData.karat}\n`;
    }
    if (productData.weight) {
      prompt += `Weight: ${productData.weight} grams\n`;
    }
    if (productData.design_type) {
      prompt += `Design Type: ${productData.design_type}\n`;
    }
    if (productData.price) {
      prompt += `Price: ${productData.price} EGP\n`;
    }
    if (productData.features && productData.features.length > 0) {
      prompt += `Key Features: ${productData.features.join(', ')}\n`;
    }
    if (productData.targetAudience) {
      prompt += `Target Audience: ${productData.targetAudience}\n`;
    }
    if (productData.basicDescription) {
      prompt += `Basic Description: ${productData.basicDescription}\n`;
    }
    if (productData.description) {
      prompt += `Additional Details: ${productData.description}\n`;
    }

    prompt += `\nPlease create a compelling product description that:\n`;
    prompt += `- Highlights key benefits and features\n`;
    prompt += `- Uses persuasive language\n`;
    prompt += `- Is SEO-friendly\n`;
    prompt += `- Maintains a professional and inviting tone\n`;
    prompt += `- Focuses on customer value and appeal\n`;
    prompt += `- Is concise (50-100 words)\n`;

    return prompt;
  }

  /**
   * Generate multiple description variations
   */
  async generateVariations(productData, count = 3) {
    const descriptions = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const description = await this.generateDescription(productData);
        descriptions.push(description);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error generating variation ${i + 1}:`, error);
      }
    }
    
    return descriptions;
  }
}

export default AIProductDescriptionService;
