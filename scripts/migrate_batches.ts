import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Also try .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing VITE_TURSO_DATABASE_URL or VITE_TURSO_AUTH_TOKEN in environment variables.");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function migrate() {
  console.log("Starting batch migration for students...");

  // Get all students
  const studentsResult = await client.execute("SELECT id, name, course, batch_number FROM students");
  const students = studentsResult.rows;

  // Get all batches
  const batchesResult = await client.execute("SELECT id, name, course_id FROM batches");
  const batches = batchesResult.rows;

  // Create a map of course_id -> batch_id (just take the first batch found for the course)
  const courseBatches: Record<string, string> = {};
  for (const b of batches) {
    if (b.course_id && !courseBatches[b.course_id as string]) {
      courseBatches[b.course_id as string] = b.id as string;
    }
    // Also map by name if they match loosely
    if (b.name && !courseBatches[b.name as string]) {
      courseBatches[b.name as string] = b.id as string;
    }
  }

  let migratedCount = 0;

  for (const student of students) {
    const course = student.course as string;
    const batchNumber = student.batch_number as string;

    if (!batchNumber || batchNumber.trim() === '') {
      if (course) {
        let matchingBatchId = courseBatches[course];
        if (!matchingBatchId) {
          // Try to find a batch loosely
          for (const b of batches) {
             if ((b.course_id && (b.course_id as string).toLowerCase().includes(course.toLowerCase())) ||
                 (b.name && (b.name as string).toLowerCase().includes(course.toLowerCase()))) {
                 matchingBatchId = b.id as string;
                 break;
             }
          }
        }

        if (matchingBatchId) {
          console.log(`Migrating student ${student.name} (${student.id}) from course ${course} to batch ${matchingBatchId}`);
          await client.execute({
            sql: "UPDATE students SET batch_number = ? WHERE id = ?",
            args: [matchingBatchId, student.id]
          });
          migratedCount++;
        } else {
          console.log(`Warning: Student ${student.name} (${student.id}) has course ${course} but no matching batch found.`);
        }
      } else {
         console.log(`Warning: Student ${student.name} (${student.id}) has no course and no batch_number.`);
      }
    }
  }

  console.log(`Migration complete. Migrated ${migratedCount} students.`);
}

migrate().catch(console.error);
