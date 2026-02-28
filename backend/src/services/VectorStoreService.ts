import path from 'path';
import { LocalDocumentIndex, OpenAIEmbeddings } from 'vectra';

const VECTOR_INDEX_PATH = path.join(__dirname, '..', '..', 'data', 'vector-index');

let docIndex: LocalDocumentIndex | null = null;

function getEmbeddings(): OpenAIEmbeddings {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in .env — required for vector embeddings');
  }
  return new OpenAIEmbeddings({
    apiKey,
    model: 'text-embedding-3-small',
    maxTokens: 8000,
  });
}

export async function getDocumentIndex(): Promise<LocalDocumentIndex> {
  if (docIndex) return docIndex;

  const embeddings = getEmbeddings();
  docIndex = new LocalDocumentIndex({
    folderPath: VECTOR_INDEX_PATH,
    embeddings,
  });

  if (!(await docIndex.isIndexCreated())) {
    await docIndex.createIndex({ version: 1 });
    console.log('[VectorStore] Created new document index at', VECTOR_INDEX_PATH);
  }

  return docIndex;
}

/**
 * Ingest a document into the vector store
 */
export async function ingestDocument(
  uri: string,
  content: string,
  docType: string = 'md'
): Promise<{ uri: string; status: string }> {
  const index = await getDocumentIndex();
  await index.upsertDocument(uri, content, docType);
  return { uri, status: 'indexed' };
}

/**
 * Query the vector store for relevant context
 */
export async function queryContext(
  query: string,
  maxDocuments: number = 5,
  maxChunks: number = 20,
  maxTokens: number = 2000
): Promise<Array<{ uri: string; score: number; text: string; tokenCount: number }>> {
  const index = await getDocumentIndex();
  const results = await index.queryDocuments(query, {
    maxDocuments,
    maxChunks,
  });

  const sections: Array<{ uri: string; score: number; text: string; tokenCount: number }> = [];
  for (const doc of results) {
    const rendered = await doc.renderSections(maxTokens, 1, true);
    for (const section of rendered) {
      sections.push({
        uri: doc.uri,
        score: doc.score,
        text: section.text,
        tokenCount: section.tokenCount,
      });
    }
  }
  return sections;
}

/**
 * Remove a document from the vector store
 */
export async function removeDocument(uri: string): Promise<void> {
  const index = await getDocumentIndex();
  await index.deleteDocument(uri);
}

/**
 * List all documents in the vector store
 */
export async function listDocuments(): Promise<Array<{ uri: string }>> {
  const index = await getDocumentIndex();
  const catalog = await (index as any).getCatalog();
  return catalog.map((entry: any) => ({ uri: entry.uri || entry }));
}

/**
 * Ingest all knowledge base entries from SQLite into vector store
 */
export async function syncKnowledgeBase(): Promise<{ synced: number }> {
  const { getDatabase } = require('../database');
  const db = getDatabase();

  const entries = db.prepare(
    'SELECT id, category, key_name, value, description FROM knowledge_base WHERE is_active = 1'
  ).all() as Array<{ id: string; category: string; key_name: string; value: string; description: string }>;

  let synced = 0;
  for (const entry of entries) {
    const uri = `kb://${entry.category}/${entry.key_name}`;
    const content = `# ${entry.key_name}\nKategori: ${entry.category}\n\n${entry.value}${entry.description ? '\n\n' + entry.description : ''}`;
    await ingestDocument(uri, content, 'md');
    synced++;
  }

  console.log(`[VectorStore] Synced ${synced} knowledge base entries`);
  return { synced };
}
