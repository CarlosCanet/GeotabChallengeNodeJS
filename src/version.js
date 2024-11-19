const fs = require("fs").promises;

// Name of the file with the configuration parameters
const CONFIG_FILE = "config.json";

// Loads the last processed versions (of the feed) from configuration file
async function loadVersions() {
  try {
    lastLogVersion = process.argv.indexOf("--gt") >= 0 ? process.argv[process.argv.indexOf("--gt") + 1].toLowerCase() : undefined;
    lastStatusVersion = process.argv.indexOf("--st") >= 0 ? process.argv[process.argv.indexOf("--st") + 1].toLowerCase() : undefined;
    if (!lastLogVersion || !lastStatusVersion) {
      const config = await fs.readFile(CONFIG_FILE);
      const configJson = JSON.parse(config.toString());
      lastLogVersion = lastLogVersion ?? (configJson.lastLogVersion)?.toLowerCase();
      lastStatusVersion = lastStatusVersion ?? (configJson.lastStatusVersion)?.toLowerCase();
      // If versions are loaded, stop using starting date
    }
    if (lastLogVersion && lastStatusVersion) startDate = undefined;
  } catch (error) {
    if (error.code !== "ENOENT") console.log(`Bad JSON config file: ${error.message}`);
  }
}
  
// Update the last processed versions of the feed
async function updateVersions() {
  await fs.writeFile(CONFIG_FILE, JSON.stringify({ lastLogVersion, lastStatusVersion }));
}

exports.loadVersions = loadVersions;
exports.updateVersions = updateVersions;