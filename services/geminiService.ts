
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { GradeLevel, MathTopic } from "../types";

const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const getSystemInstruction = (grade: GradeLevel, topic: MathTopic) => {
  return `You are a world-class math teacher. You are currently tutoring a student at the ${grade} level specifically in the area of ${topic}. 
  Tailor your language, examples, and complexity to this level. If it is University level, be rigorous. If it is Elementary, use simple analogies and encouraging language. 
  Always use LaTeX-style formatting for math equations (e.g., $x^2$).`;
};

export const generateLesson = async (grade: GradeLevel, topic: MathTopic) => {
  const ai = getClient();
  const prompt = `Generate a comprehensive lesson for a ${grade} student on the topic of ${topic}. 
  Include: 
  1. Learning Objectives.
  2. Key Formulas/Concepts (Cheat Sheet).
  3. A step-by-step worked example.
  4. A "Why it matters" section for real-world application.
  Format as clean Markdown.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { systemInstruction: getSystemInstruction(grade, topic) }
  });
  return response.text;
};

export const generateQuestions = async (grade: GradeLevel, topic: MathTopic) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate 3 distinct math practice problems for a ${grade} level student on ${topic}. Return ONLY a JSON array.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            text: { type: Type.STRING, description: "The math problem text." },
            hint: { type: Type.STRING, description: "A helpful hint." }
          },
          required: ["id", "text", "hint"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const evaluateAnswers = async (grade: GradeLevel, topic: MathTopic, questions: any[]) => {
  const ai = getClient();
  const prompt = `Evaluate the following student answers for these ${topic} problems (${grade} level):
  ${JSON.stringify(questions)}
  
  Provide feedback for each answer. If wrong, explain why and give the correct answer. 
  Return ONLY a JSON array of objects with keys: id, isCorrect (boolean), and feedback (string).`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING }
          },
          required: ["id", "isCorrect", "feedback"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
};

export const chatWithThinking = async (prompt: string, grade: GradeLevel, topic: MathTopic, history: any[] = []) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: getSystemInstruction(grade, topic),
      thinkingConfig: { thinkingBudget: 32768 }
    },
  });
  return response;
};

export const generateMathImage = async (prompt: string, grade: GradeLevel, topic: MathTopic, aspectRatio: string = "1:1", imageSize: string = "1K") => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: `Create a ${grade} level educational visualization for ${topic}: ${prompt}` }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: imageSize as any
      }
    },
  });
  
  const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  return imagePart?.inlineData?.data ? `data:image/png;base64,${imagePart.inlineData.data}` : null;
};

export const generateMathVideo = async (prompt: string, grade: GradeLevel, topic: MathTopic, aspectRatio: '16:9' | '9:16' = '16:9') => {
  const ai = getClient();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `An educational ${grade} level animation for ${topic} illustrating: ${prompt}`,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) return null;
  
  const res = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

export const analyzeMathVisual = async (base64Data: string, mimeType: string, prompt: string, grade: GradeLevel, topic: MathTopic) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: prompt }
      ]
    },
    config: {
      systemInstruction: getSystemInstruction(grade, topic)
    }
  });
  return response.text;
};

export const speakText = async (text: string) => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) return null;

  return base64Audio;
};
