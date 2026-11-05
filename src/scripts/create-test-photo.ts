/**
 * Create a test photo for ingest script testing
 */
import sharp from 'sharp';
import fs from 'fs';

async function createTestPhoto() {
  const outputPath = 'test-photo.jpg';

  // Create a simple 800x600 green image
  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: '#27ae60', // Green
    },
  })
    .jpeg({ quality: 90 })
    .toFile(outputPath);

  const stats = fs.statSync(outputPath);
  console.log(`✅ Test photo created: ${outputPath} (${(stats.size / 1024).toFixed(2)}KB)`);
}

createTestPhoto().catch((error) => {
  console.error('❌ Failed to create test photo:', error);
  process.exit(1);
});
