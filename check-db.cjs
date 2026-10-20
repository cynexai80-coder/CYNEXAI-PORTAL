const { createClient } = require('@libsql/client');
const client = createClient({ 
  url: 'libsql://cynexai-portal-cynexai-new.aws-ap-south-1.turso.io', 
  authToken: process.env.VITE_TURSO_AUTH_TOKEN 
});
client.execute("SELECT title, youtube_video_id FROM classes WHERE title LIKE '%Introduction%'")
  .then(r => {
    const id = r.rows[0].youtube_video_id;
    console.log(`[${id}] length: ${id.length}`);
  })
  .catch(console.error);
