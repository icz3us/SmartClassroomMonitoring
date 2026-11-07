import nextEnv from "@next/env";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL)
  throw new Error("Set NEXT_PUBLIC_FIREBASE_DATABASE_URL in .env.local");
initializeApp({
  credential: applicationDefault(),
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
});
export const db = getDatabase();
export const auth = getAuth();
