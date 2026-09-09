const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN
});

async function seedQuizzes() {
  console.log("=== SEEDING 4 MCQS AND 2 CODING CHALLENGES PER CLASS ===");

  try {
    const clsRes = await client.execute("SELECT id, title, module_id FROM classes ORDER BY order_index ASC");
    const classes = clsRes.rows;
    console.log(`Found ${classes.length} classes to process.`);

    let insertedCount = 0;

    for (const cls of classes) {
      const cId = cls.id;
      const title = cls.title || 'Topic Class';

      // Check existing questions for this class
      const existing = await client.execute({
        sql: "SELECT id, type FROM class_questions WHERE class_id = ?",
        args: [cId]
      });

      const mcqCount = existing.rows.filter(r => r.type === 'mcq').length;
      const codingCount = existing.rows.filter(r => r.type === 'coding' || r.type === 'code').length;

      // 1. Ensure 4 MCQs
      for (let i = mcqCount; i < 4; i++) {
        const qId = `q_mcq_${cId}_${i + 1}_${Date.now()}`;
        let questionText = ``;
        let options = [];
        let correctIdx = 0;

        if (i === 0) {
          questionText = `What is the primary concept covered in ${title}?`;
          options = [
            `Understanding core mechanics and fundamentals of ${title}`,
            `Only deprecated legacy functions`,
            `External database hardware configuration`,
            `None of the above`
          ];
          correctIdx = 0;
        } else if (i === 1) {
          questionText = `Which of the following is a recommended best practice when working with ${title}?`;
          options = [
            `Hardcoding raw credentials in source files`,
            `Writing modular, reusable, and cleanly tested functions`,
            `Ignoring exception handling`,
            `Disabling runtime validation`
          ];
          correctIdx = 1;
        } else if (i === 2) {
          questionText = `What is the expected output type when processing valid data inputs in ${title}?`;
          options = [
            `Undefined null pointer`,
            `Raw unformatted byte streams`,
            `Structured, clean value data (List, Dict, Int, or String)`,
            `Syntax error exception`
          ];
          correctIdx = 2;
        } else {
          questionText = `Why is ${title} essential in modern software and AI development pipelines?`;
          options = [
            `It reduces algorithmic execution time and optimizes data workflows`,
            `It increases server power consumption`,
            `It prevents files from saving`,
            `It is only used for styling UI`
          ];
          correctIdx = 0;
        }

        await client.execute({
          sql: `INSERT INTO class_questions (id, class_id, type, question_text, options_json, correct_answer_idx, created_at)
                VALUES (?, ?, 'mcq', ?, ?, ?, ?)`,
          args: [qId, cId, questionText, JSON.stringify(options), correctIdx, new Date().toISOString()]
        });
        insertedCount++;
      }

      // 2. Ensure 2 Coding Challenges
      for (let i = codingCount; i < 2; i++) {
        const qId = `q_code_${cId}_${i + 1}_${Date.now()}`;
        let questionText = ``;
        let boilerplate = ``;
        let testCases = [];

        if (i === 0) {
          questionText = `Coding Challenge 1: Data Transformation for ${title}. Write a function 'solution(data)' that returns the processed length or formatted result of the input list/string.`;
          boilerplate = `def solution(data):\n    # TODO: Implement solution for ${title}\n    if isinstance(data, list):\n        return sum(data)\n    elif isinstance(data, str):\n        return data.upper()\n    return data\n\n# Test call\nprint(solution([10, 20, 30]))`;
          testCases = [
            { input: "[10, 20, 30]", expected: "60", desc: "Test 1: Numeric List Sum" },
            { input: "'cynexai'", expected: "CYNEXAI", desc: "Test 2: String Formatting" }
          ];
        } else {
          questionText = `Coding Challenge 2: Algorithmic Verification for ${title}. Write a function 'verify_data(n)' that returns True if 'n' is positive and even, otherwise False.`;
          boilerplate = `def verify_data(n):\n    # TODO: Check if n is positive and even\n    return n > 0 and n % 2 == 0\n\n# Test call\nprint(verify_data(4))`;
          testCases = [
            { input: "4", expected: "True", desc: "Test 1: Positive Even Number" },
            { input: "7", expected: "False", desc: "Test 2: Odd Number" }
          ];
        }

        await client.execute({
          sql: `INSERT INTO class_questions (id, class_id, type, question_text, boilerplate_json, test_cases_json, created_at)
                VALUES (?, ?, 'coding', ?, ?, ?, ?)`,
          args: [qId, cId, questionText, boilerplate, JSON.stringify(testCases), new Date().toISOString()]
        });
        insertedCount++;
      }
    }

    console.log(`\n✓ Seeding complete! Successfully added ${insertedCount} questions across all classes.`);
  } catch (err) {
    console.error("seedQuizzes failed:", err);
  }
}

seedQuizzes();
