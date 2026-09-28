import { ChromaClient } from "chromadb";

const client = new ChromaClient({
  host: "my-chromadb-server-paj3.onrender.com",
  port: 443,
  ssl: true,
});

async function checkDatabase() {
  try {
    console.log("Connecting to ChromaDB...");
    
    // Check Global Knowledge Base
    const globalCollection = await client.getOrCreateCollection({ name: "codezy_knowledge" });
    const globalCount = await globalCollection.count();
    console.log(`\n📚 [codezy_knowledge]: ${globalCount} document chunks stored.`);
    
    // Check User Uploaded PDFs
    const userCollection = await client.getOrCreateCollection({ name: "user_documents" });
    const userCount = await userCollection.count();
    console.log(`\n📄 [user_documents]: ${userCount} document chunks stored.`);

    if (userCount > 0) {
      console.log("\nFetching top 5 chunks from user_documents to verify metadata...");
      const data = await userCollection.get({ limit: 5 });
      
      data.metadatas.forEach((meta, index) => {
        console.log(`- Chunk ${index + 1}: Source File -> "${meta.source}" (Conversation: ${meta.conversation_id})`);
      });
    }

  } catch (error) {
    console.error("\n❌ Error connecting to ChromaDB:", error.message);
  }
}

checkDatabase();
