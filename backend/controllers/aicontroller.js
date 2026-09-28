import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";
import { PDFParse } from "pdf-parse";

dotenv.config({
  path: "./.env",
});

const client = new ChromaClient({
  host: "my-chromadb-server-paj3.onrender.com",
  port: 443,
  ssl: true,
});

const embeddingFunction = new DefaultEmbeddingFunction();

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0,
});

const prompt = PromptTemplate.fromTemplate(`
You are the Codezy AI Assistant.

Answer the user's question clearly, accurately, and helpfully.

You have access to two sources of information:

1. Codezy Knowledge Base
2. Your general knowledge

Use the Codezy knowledge base when relevant.

If the Codezy context contains information relevant to the
question, prioritize that information.

If the Codezy context does NOT contain relevant information,
you may answer using your general knowledge.

Do NOT claim that information came from the Codezy knowledge
base unless it actually appears in the provided context.

Use the conversation history to understand references such as
"it", "that", "this", "what about Python", etc.

Do not invent information presented as Codezy-specific facts.

Conversation History:

{history}

Codezy Context:

{context}

Current Question:

{question}

Answer:
`);

export const askAI = async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        message: "Question is required",
      });
    }

    const collection = await client.getOrCreateCollection({
      name: "codezy_knowledge",
      embeddingFunction,
    });

    // --------------------------------
    // RETRIEVE RELEVANT CHUNKS
    // --------------------------------

    const results = await collection.query({
      queryTexts: [question],
      nResults: 3,
    });

    let documents = results.documents[0] || [];
    let metadatas = results.metadatas[0] || [];
    let distances = results.distances?.[0] || [];

    const { conversationId } = req.body;
    if (conversationId) {
      try {
        const userDocsCollection = await client.getOrCreateCollection({
          name: "user_documents",
          embeddingFunction,
        });
        const userResults = await userDocsCollection.query({
          queryTexts: [question],
          nResults: 3,
          where: { conversation_id: conversationId },
        });
        if (userResults.documents && userResults.documents[0].length > 0) {
          documents = [...documents, ...userResults.documents[0]];
          metadatas = [...metadatas, ...userResults.metadatas[0]];
          distances = [...distances, ...userResults.distances[0]];
        }
      } catch (err) {
        console.error("Failed to query user docs", err);
      }
    }

    // --------------------------------
    // FILTER IRRELEVANT RESULTS
    // --------------------------------

    const DISTANCE_THRESHOLD = 0.8;

    const relevantResults = documents
      .map((document, index) => ({
        document,
        metadata: metadatas[index],
        distance: distances[index],
      }))
      .filter(
        (result) =>
          result.distance !== undefined &&
          result.distance <= DISTANCE_THRESHOLD,
      );

    // --------------------------------
    // CREATE CONTEXT
    // --------------------------------

    const context = relevantResults
      .map((result) => {
        return `Source: ${
          result.metadata?.source || "unknown"
        }\n${result.document}`;
      })
      .join("\n\n");

    // Create conversation history
    const conversation = history
      .slice(-6)
      .map((message) => {
        return `${message.role}: ${message.content}`;
      })
      .join("\n");

    // Create LangChain prompt
    const formattedPrompt = await prompt.format({
      history: conversation,
      context,
      question,
    });

    // Remove duplicate sources
    const sources = [
      ...new Set(
        relevantResults
          .map((result) => result.metadata?.source)
          .filter(Boolean),
      ),
    ];

    // --------------------------------
    // STREAM RESPONSE
    // --------------------------------

    const stream = await model.stream(formattedPrompt);

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");

    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Transfer-Encoding", "chunked");

    // Stream AI chunks
    for await (const chunk of stream) {
      const content = chunk.content || "";

      if (content) {
        res.write(
          JSON.stringify({
            type: "chunk",
            content,
          }) + "\n",
        );
      }
    }

    // Send sources after answer is complete
    res.write(
      JSON.stringify({
        type: "sources",
        sources,
      }) + "\n",
    );

    // Tell frontend streaming is finished
    res.write(
      JSON.stringify({
        type: "done",
      }) + "\n",
    );

    res.end();
  } catch (error) {
    console.error("AI controller error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Failed to generate AI response",
      });
    }

    res.end();
  }
};

export const uploadPDF = async (req, res) => {
  try {
    const file = req.file;
    const conversationId = req.body.conversationId;

    if (!file || !conversationId) {
      return res.status(400).json({ message: "File and conversationId are required" });
    }

    const parser = new PDFParse({ data: file.buffer });
    const pdfData = await parser.getText();
    const text = pdfData.text;
    await parser.destroy();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.splitText(text);

    const userDocsCollection = await client.getOrCreateCollection({
      name: "user_documents",
      embeddingFunction,
    });

    const ids = chunks.map((_, i) => `${conversationId}_${Date.now()}_${i}`);
    const metadatas = chunks.map(() => ({
      source: file.originalname,
      conversation_id: conversationId,
    }));

    await userDocsCollection.upsert({
      ids,
      documents: chunks,
      metadatas,
    });

    res.status(200).json({ message: "PDF processed successfully" });
  } catch (error) {
    console.error("Upload PDF error:", error);
    res.status(500).json({ message: "Failed to process PDF" });
  }
};
