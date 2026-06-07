import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow parsing of large code uploads
  app.use(express.json({ limit: "15mb" }));

  // Initialize Gemini Client safely with lazy check
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is missing. Configure it in Settings > Secrets first.");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // API Route: parse uploaded code or schema definition to extract tables
  app.post("/api/parse-schema", async (req, res) => {
    try {
      const { code, fileName } = req.body;
      if (!code) {
        return res.status(400).json({ error: "No code or text outline received" });
      }

      const prompt = `You are a professional database developer. Parse the following file ("${fileName || 'schema.txt'}") containing data structure declarations or code, and extract the relational schema representation (tables, columns, types, primary/foreign keys).
The file content could be SQL DDL statements (e.g. CREATE TABLE), Sequelize/Prisma ORM models, TypeScript interfaces, Python classes, CSV column definitions, or raw text descriptions of columns.

Input to analyze:
\`\`\`
${code}
\`\`\`

Rules for extraction:
1. Normalise names of tables and columns to standard SQL style (lower_case_with_underscores).
2. Infer types (e.g., INT, VARCHAR, TEXT, DECIMAL, BOOLEAN, DATE, TIMESTAMP) based on database context.
3. Identify primary keys and logical foreign key connections (e.g., if columns reference fields like "user_id" in other tables, map them as foreign relationship links).
4. If the input contains no valid database structure, map the described data requirements visually to clean logical tables.
`;

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an automated schema parser. Output schema extraction as a precise JSON array of table definitions conforming strictly to the requested schema. Do not include markdown code block characters around the JSON in the raw output itself.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "Array of tables parsed from the text",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the table" },
                columns: {
                  type: Type.ARRAY,
                  description: "Columns defined in this table",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: "Column name" },
                      type: { type: Type.STRING, description: "Logical data type for this database engine (e.g. INT, VARCHAR, TEXT, BOOLEAN, TIMESTAMP)" },
                      primaryKey: { type: Type.BOOLEAN, description: "True if this column constitutes a primary key" },
                      notNull: { type: Type.BOOLEAN, description: "True if non-nullable" },
                      foreignKey: {
                        type: Type.OBJECT,
                        description: "Optional reference tracking another table's reference column",
                        properties: {
                          table: { type: Type.STRING, description: "Name of the reference table" },
                          column: { type: Type.STRING, description: "Name of the referenced column" }
                        },
                        required: ["table", "column"]
                      }
                    },
                    required: ["name", "type", "primaryKey", "notNull"]
                  }
                }
              },
              required: ["name", "columns"]
            }
          }
        },
      });

      const responseText = response.text || "[]";
      let parsed = [];
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        console.warn("Could not parse directly, trying to clean JSON text", e);
        const match = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error("Unable to parse structured JSON response from AI client");
        }
      }

      res.json({ tables: parsed });
    } catch (error: any) {
      console.error("AI parse schema error:", error);
      res.status(500).json({ error: error.message || "Failed to parse schema using AI model" });
    }
  });

  // Health and verification check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      hasGeminiKey: !!process.env.GEMINI_API_KEY 
    });
  });

  // Mount Vite middleware for asset pipeline serving or fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running securely on port ${PORT}`);
  });
}

startServer();
