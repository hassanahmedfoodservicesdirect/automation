import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { DataStore } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const defaultStore: DataStore = {
  leads: [],
  audits: [],
  outreach: [],
  proposals: []
};

async function ensureStore(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_PATH, "utf-8");
  } catch {
    await writeFile(STORE_PATH, JSON.stringify(defaultStore, null, 2), "utf-8");
  }
}

export async function readStore(): Promise<DataStore> {
  await ensureStore();
  const content = await readFile(STORE_PATH, "utf-8");
  return JSON.parse(content) as DataStore;
}

export async function writeStore(store: DataStore): Promise<void> {
  await ensureStore();
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
