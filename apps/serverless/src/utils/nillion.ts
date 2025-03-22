/**
 * Utility function to call the Nillion LLM API
 */

// Interface for LLM API request
interface LLMRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

// Interface for LLM API response
interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Calls the Nillion LLM API with the given prompt
 * @param apiUrl The URL of the LLM API
 * @param apiKey The API key for authentication
 * @param systemPrompt The system prompt to set context for the LLM
 * @param userPrompt The user's query or prompt
 * @returns The API response or null if the request fails
 */
export async function callNillionLLM(
  apiUrl: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResponse | null> {
  try {
    // Prepare the request payload
    const requestBody: LLMRequest = {
      model: "gpt-3.5-turbo", // Default model
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    };

    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    // Check for success
    if (!response.ok) {
      console.error(`LLM API error: ${response.status} ${response.statusText}`);
      return null;
    }

    // Parse and return the response
    return await response.json();
  } catch (error) {
    console.error('Error calling Nillion LLM:', error);
    return null;
  }
} 