
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeContextWithAI(context: string, discipline: string, grade: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Actúa como un experto en la Nueva Escuela Mexicana (NEM). 
    Analiza el siguiente contexto escolar de la Escuela Secundaria General "Leonarda Gómez Blanco" y genera 15 problemáticas educativas específicas, críticas y situadas que se puedan abordar desde la disciplina de ${discipline} para ${grade}° grado.
    
    Contexto: ${context}
    
    Las problemáticas deben ser redactadas de forma clara, iniciando con un verbo o sustantivo que denote el conflicto o necesidad (ej. "Bajo nivel de comprensión lectora...", "Falta de conciencia ambiental...").
    
    Devuelve un arreglo JSON de strings con las 15 problemáticas.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]") as string[];
  } catch (e) {
    console.error("Error parsing AI response", e);
    return [];
  }
}

export async function generateProjectDetailsWithAI(problem: string, discipline: string, grade: string, methodology: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Actúa como un diseñador pedagógico experto en la NEM. 
    Basado en la problemática "${problem}", la disciplina ${discipline}, el grado ${grade}° y la metodología ${methodology}, genera una propuesta de proyecto innovadora.
    
    Requerimientos:
    1. 10 opciones creativas de nombres de proyectos que sean atractivos para adolescentes.
    2. 15 opciones de productos integradores (tangibles o intangibles) que demuestren el aprendizaje.
    3. Una justificación pedagógica sólida que explique por qué este proyecto es relevante para la problemática y cómo se vincula con la realidad del alumno (aprox 120 palabras).
    4. 5 orientaciones didácticas (pasos o sugerencias clave para el docente).
    5. 4 sugerencias de evaluación formativa (instrumentos o procesos).
    
    Devuelve un objeto JSON con las propiedades: titles (array), products (array), justification (string), orientations (array), evaluation (array).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          titles: { type: Type.ARRAY, items: { type: Type.STRING } },
          products: { type: Type.ARRAY, items: { type: Type.STRING } },
          justification: { type: Type.STRING },
          orientations: { type: Type.ARRAY, items: { type: Type.STRING } },
          evaluation: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["titles", "products", "justification", "orientations", "evaluation"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Error parsing AI response", e);
    return null;
  }
}

export async function distributeContentsWithAI(problems: string[], contents: {t: string, pda: string}[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Actúa como un experto curricular. Tengo 3 problemáticas prioritarias y una lista de contenidos oficiales. 
    Debes distribuir TODOS los contenidos en 3 grupos (uno para cada problemática/trimestre) basándote en la afinidad temática.
    
    Problemáticas:
    1. ${problems[0]}
    2. ${problems[1]}
    3. ${problems[2]}
    
    Contenidos:
    ${contents.map((c, i) => `${i}: ${c.t}`).join('\n')}
    
    Devuelve un objeto JSON donde las llaves sean "1", "2", "3" (correspondientes a los trimestres) y los valores sean arreglos con los ÍNDICES de los contenidos asignados.
    Asegúrate de que todos los contenidos sean asignados y que la distribución sea equilibrada.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          "1": { type: Type.ARRAY, items: { type: Type.INTEGER } },
          "2": { type: Type.ARRAY, items: { type: Type.INTEGER } },
          "3": { type: Type.ARRAY, items: { type: Type.INTEGER } }
        },
        required: ["1", "2", "3"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as Record<string, number[]>;
  } catch (e) {
    console.error("Error distributing contents", e);
    return null;
  }
}
