// Compatibility entrypoint for the old QA command. The current story uses real
// instruments and fifteen operations; the former question-button harness is retired.
for (const [current, legacy] of [
  ['PLAYWRIGHT_MODULE_PATH', 'PLAYWRIGHT_MODULE'],
  ['CHROME_BIN', 'CHROMIUM_EXECUTABLE'],
  ['APOLLO_STORY_URL', 'QA_BASE_URL'],
  ['APOLLO_STORY_OUTPUT', 'QA_OUTPUT_DIR'],
]) {
  if (!process.env[current] && process.env[legacy]) process.env[current] = process.env[legacy];
}
process.chdir(require('node:path').resolve(__dirname,'..'));
import('./qa-apollo-story.mjs').catch(error=>{console.error(error);process.exitCode=1;});
